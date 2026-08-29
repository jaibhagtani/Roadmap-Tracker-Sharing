import type { Prisma } from '@prisma/client';
import { canEditTopic, getRoadmapRole, recordChange } from '@/lib/collab-access';

export type BranchResource = {
  id: string; title: string; url: string; type: string; notes: string; completed: boolean; favorite: boolean;
};
export type BranchTopic = {
  id: string; roadmapId: string; parentId: string | null; title: string; description: string; notes: string;
  status: 'not_started'|'in_progress'|'completed'; progress: number; priority: number; position: number;
  tags: string[]; dueDate: string | null; resources: BranchResource[];
};
export type BranchSnapshot = {
  roadmap: { id: string; ownerId: string; title: string; description: string; privacy: 'private'|'link'|'public'; shareSlug: string; editorState?: any };
  topics: BranchTopic[];
};

export async function loadSnapshot(tx: Prisma.TransactionClient, roadmapId: string, rootTopicId?: string | null): Promise<BranchSnapshot> {
  const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { id: true, ownerId: true, title: true, description: true, privacy: true, shareSlug: true, editorState: true } });
  if (!roadmap) throw new Error('NOT_FOUND');
  const all = await tx.topic.findMany({ where: { roadmapId }, orderBy: [{ parentId: 'asc' }, { position: 'asc' }], include: { resources: { orderBy: { createdAt: 'asc' } } } });
  let topics = all;
  if (rootTopicId) {
    const ids = new Set<string>([rootTopicId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of all) if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) { ids.add(t.id); changed = true; }
    }
    topics = all.filter((t: { id: string; parentId: string | null }) => ids.has(t.id));
  }
  return {
    roadmap: { ...roadmap, privacy: String(roadmap.privacy) as BranchSnapshot['roadmap']['privacy'] },
    topics: topics.map((t: typeof topics[number]) => ({
      id: t.id, roadmapId: t.roadmapId, parentId: t.parentId, title: t.title, description: t.description, notes: t.notes,
      status: String(t.status) as BranchTopic['status'], progress: t.progress, priority: t.priority, position: t.position, tags: t.tags,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0,10) : null,
      resources: t.resources.map((r: { id: string; title: string; url: string; type: string; notes: string; completed: boolean; favorite: boolean }) => ({ id: r.id, title: r.title, url: r.url, type: r.type, notes: r.notes, completed: r.completed, favorite: r.favorite })),
    })),
  };
}

export function cloneSnapshot<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

export function applySnapshotOperation(snapshot: BranchSnapshot, op: string, payload: any, rootTopicId: string | null = null) {
  const topics = snapshot.topics;
  if (op === 'roadmap:update') {
    if (rootTopicId) throw new Error('SCOPED_BRANCH_ROADMAP_EDIT');
    const d = payload?.data ?? {};
    if (typeof d.title === 'string') snapshot.roadmap.title = d.title.trim().slice(0,200);
    if (typeof d.description === 'string') snapshot.roadmap.description = d.description.slice(0,5000);
    if (d.privacy === 'private' || d.privacy === 'link' || d.privacy === 'public') snapshot.roadmap.privacy = d.privacy;
    if (d.editorState && typeof d.editorState === 'object') snapshot.roadmap.editorState = d.editorState;
    return { roadmap: snapshot.roadmap };
  }
  if (op === 'topic:create') {
    const parentId = payload?.parentId ?? null;
    if (rootTopicId && !parentId) throw new Error('SCOPED_BRANCH_PARENT_REQUIRED');
    if (parentId && !topics.some(t => t.id === parentId)) throw new Error('PARENT_NOT_IN_BRANCH');
    const siblings = topics.filter(t => t.parentId === parentId);
    const id = crypto.randomUUID();
    const topic: BranchTopic = {
      id, roadmapId: snapshot.roadmap.id, parentId,
      title: String(payload?.title ?? 'Untitled').trim().slice(0,200), description: String(payload?.description ?? '').slice(0,5000),
      notes: String(payload?.notes ?? '').slice(0,50000),
      status: payload?.status === 'completed' ? 'completed' : payload?.status === 'in_progress' ? 'in_progress' : 'not_started',
      progress: Math.max(0, Math.min(100, Number(payload?.progress ?? 0))),
      priority: Math.max(0, Math.min(5, Number(payload?.priority ?? 0))),
      position: siblings.length ? Math.max(...siblings.map(t=>t.position))+1 : 0,
      tags: Array.isArray(payload?.tags) ? payload.tags.map(String).slice(0,30) : [],
      dueDate: payload?.dueDate ? String(payload.dueDate).slice(0,10) : null,
      resources: [],
    };
    topics.push(topic);
    return { topic };
  }
  const topic = topics.find(t => t.id === String(payload?.id));
  if (op === 'topic:update') {
    if (!topic) throw new Error('NOT_FOUND');
    const d = payload?.data ?? {};
    if (rootTopicId && topic.id === rootTopicId && d.parentId !== undefined && (d.parentId ?? null) !== topic.parentId) throw new Error('SCOPED_ROOT_MOVE_FORBIDDEN');
    if (rootTopicId && topic.id !== rootTopicId && d.parentId !== undefined && d.parentId !== null && !topics.some(t => t.id === d.parentId)) throw new Error('PARENT_NOT_IN_BRANCH');
    if (d.parentId !== undefined) {
      const nextParent = d.parentId ?? null;
      if (nextParent === topic.id) throw new Error('SELF_PARENT');
      if (nextParent && !topics.some(t => t.id === nextParent)) throw new Error('PARENT_NOT_IN_BRANCH');
      let cur = nextParent; let guard = 0;
      while (cur && guard++ < 2000) {
        if (cur === topic.id) throw new Error('CYCLE');
        cur = topics.find(t => t.id === cur)?.parentId ?? null;
      }
      topic.parentId = nextParent;
    }
    for (const key of ['title','description','notes','priority','tags'] as const) if (d[key] !== undefined) (topic as any)[key] = d[key];
    if (d.status !== undefined) topic.status = d.status;
    if (d.progress !== undefined) topic.progress = Math.max(0, Math.min(100, Number(d.progress) || 0));
    if (d.status === 'completed') topic.progress = 100;
    if (d.dueDate !== undefined) topic.dueDate = d.dueDate ? String(d.dueDate).slice(0,10) : null;
    return { topic };
  }
  if (op === 'topic:delete') {
    if (!topic) throw new Error('NOT_FOUND');
    if (rootTopicId && topic.id === rootTopicId) throw new Error('SCOPED_ROOT_DELETE_FORBIDDEN');
    const ids = new Set<string>([topic.id]); let changed = true;
    while (changed) { changed = false; for (const t of topics) if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) { ids.add(t.id); changed = true; } }
    snapshot.topics = topics.filter(t => !ids.has(t.id));
    return { id: topic.id };
  }
  if (op === 'resource:create') {
    const t = topics.find(x => x.id === String(payload?.topicId)); if (!t) throw new Error('NOT_FOUND');
    const resource: BranchResource = { id: crypto.randomUUID(), title: String(payload?.title ?? 'Resource').trim().slice(0,300), url: String(payload?.url ?? '').trim().slice(0,2000), type: String(payload?.type ?? 'other').slice(0,80), notes: String(payload?.notes ?? '').slice(0,5000), completed: !!payload?.completed, favorite: !!payload?.favorite };
    t.resources.push(resource); return { resource };
  }
  if (op === 'resource:update') {
    const t = topics.find(x => x.resources.some(r => r.id === String(payload?.id))); if (!t) throw new Error('NOT_FOUND');
    const r = t.resources.find(x => x.id === String(payload?.id))!; const d = payload?.data ?? {};
    for (const key of ['title','url','type','notes','completed','favorite'] as const) if (d[key] !== undefined) (r as any)[key] = d[key];
    return { resource: r };
  }
  if (op === 'resource:delete') {
    for (const t of topics) { const i = t.resources.findIndex(r => r.id === String(payload?.id)); if (i >= 0) { t.resources.splice(i,1); return { id: String(payload.id) }; } }
    throw new Error('NOT_FOUND');
  }
  throw new Error('UNSUPPORTED_OPERATION');
}

export async function ensureBranchAccess(tx: Prisma.TransactionClient, userId: string, branch: { roadmapId: string; ownerId: string; rootTopicId: string|null }) {
  if (branch.ownerId === userId) return 'owner';
  const role = await getRoadmapRole(tx, userId, branch.roadmapId);
  if (role === 'owner') return 'leader';
  if (branch.rootTopicId) {
    if (await canEditTopic(tx, userId, branch.roadmapId, branch.rootTopicId)) return 'topic_editor';
  } else if (role === 'contributor') return 'contributor';
  return 'none';
}

export async function mergeSnapshot(tx: Prisma.TransactionClient, snapshot: BranchSnapshot, rootTopicId: string | null) {
  const keepTopicIds = new Set(snapshot.topics.map(t => t.id));
  if (rootTopicId) {
    const existing = await tx.topic.findUnique({ where: { id: rootTopicId }, select: { roadmapId: true } });
    if (!existing || existing.roadmapId !== snapshot.roadmap.id) throw new Error('NOT_FOUND');
    const current = await tx.topic.findMany({ where: { roadmapId: snapshot.roadmap.id }, select: { id: true, parentId: true } });
    const descendants = new Set<string>([rootTopicId]); let changed = true;
    while (changed) { changed=false; for (const t of current) if (t.parentId && descendants.has(t.parentId) && !descendants.has(t.id)) { descendants.add(t.id); changed=true; } }
    for (const id of descendants) if (!keepTopicIds.has(id)) await tx.topic.delete({ where: { id } });
  } else {
    await tx.roadmap.update({ where: { id: snapshot.roadmap.id }, data: { title: snapshot.roadmap.title, description: snapshot.roadmap.description, privacy: snapshot.roadmap.privacy, ...(snapshot.roadmap.editorState ? { editorState: snapshot.roadmap.editorState as any } : {}) } });
    const current = await tx.topic.findMany({ where: { roadmapId: snapshot.roadmap.id }, select: { id: true } });
    for (const t of current) if (!keepTopicIds.has(t.id)) await tx.topic.delete({ where: { id: t.id } });
  }
  // Upsert in parent-first order.
  const pending = [...snapshot.topics]; let guard = 0;
  while (pending.length && guard++ < snapshot.topics.length * 3 + 10) {
    const next: BranchTopic[] = [];
    let made = 0;
    for (const t of pending) {
      if (t.parentId) {
        const parentIsExternalRoot = !!rootTopicId && t.id === rootTopicId && !keepTopicIds.has(t.parentId);
        if (!keepTopicIds.has(t.parentId) && !parentIsExternalRoot) { next.push(t); continue; }
        if (!parentIsExternalRoot) {
          const parentExists = await tx.topic.findUnique({ where: { id: t.parentId }, select: { id: true } });
          if (!parentExists) { next.push(t); continue; }
        }
      }
      const existing = await tx.topic.findUnique({ where: { id: t.id }, select: { id: true } });
      const base = { roadmapId: snapshot.roadmap.id, parentId: t.parentId, title: t.title, description: t.description, notes: t.notes, status: t.status, progress: t.progress, priority: t.priority, position: t.position, tags: t.tags, dueDate: t.dueDate ? new Date(t.dueDate) : null };
      if (existing) await tx.topic.update({ where: { id: t.id }, data: base });
      else await tx.topic.create({ data: { id: t.id, ...base } });
      await tx.resource.deleteMany({ where: { topicId: t.id } });
      if (t.resources.length) await tx.resource.createMany({ data: t.resources.map((r: { id: string; title: string; url: string; type: string; notes: string; completed: boolean; favorite: boolean }) => ({ id: r.id, topicId: t.id, title: r.title, url: r.url, type: r.type, notes: r.notes, completed: r.completed, favorite: r.favorite })) });
      made++;
    }
    if (!made) throw new Error('BRANCH_PARENT_CONFLICT');
    pending.splice(0, pending.length, ...next);
  }
}
