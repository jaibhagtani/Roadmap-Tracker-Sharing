import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { errorResponse, withRls } from '@/lib/db';
import { assertCanEditRoadmap, canEditTopic, getRoadmapRole, recordChange } from '@/lib/collab-access';

const bodySchema = z.object({
  op: z.enum([
    'roadmap:update',
    'topic:create', 'topic:update', 'topic:delete',
    'resource:create', 'resource:update', 'resource:delete',
  ]),
  expectedVersion: z.number().int().nonnegative().optional(),
  payload: z.record(z.string(), z.any()).default({}),
});

async function isDescendant(tx: any, rootId: string, candidateId: string) {
  let current = await tx.topic.findUnique({ where: { id: candidateId }, select: { parentId: true } });
  for (let i = 0; i < 2000 && current?.parentId; i += 1) {
    if (current.parentId === rootId) return true;
    current = await tx.topic.findUnique({ where: { id: current.parentId }, select: { parentId: true } });
  }
  return false;
}

async function ensureVersion(tx: any, roadmapId: string, expectedVersion?: number) {
  if (expectedVersion === undefined) return;
  const current = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { version: true } });
  if (!current) throw new Error('NOT_FOUND');
  if (current.version !== expectedVersion) throw new Error('CONFLICT');
}

async function nextPosition(tx: any, roadmapId: string, parentId: string | null) {
  const max = await tx.topic.aggregate({ where: { roadmapId, parentId }, _max: { position: true } });
  return (max._max.position ?? -1) + 1;
}

export async function POST(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const body = bodySchema.parse(await req.json());

    const result = await withRls(user.id, async tx => {
      const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { id: true, ownerId: true, version: true } });
      if (!roadmap) throw new Error('NOT_FOUND');
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role === 'none') throw new Error('FORBIDDEN');
      const group = await tx.collabGroup.findUnique({ where: { roadmapId }, select: { id: true, settings: true } });
      const groupMember = group ? await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } }, select: { role: true } }) : null;
      const groupSettings = (group?.settings as any) || {};
      const groupKind = groupSettings.kind === 'community' ? 'community' : 'team';
      const directGroup = !!groupMember && groupMember.role !== 'viewer' && (groupKind === 'community' || groupSettings.directCollaboration !== false);
      if (role !== 'owner' && !directGroup) throw new Error('LEADER_ONLY');
      await ensureVersion(tx, roadmapId, body.expectedVersion);

      let result: any;
      let operation = body.op;
      let entityType = 'roadmap';
      let entityId: string | null = roadmapId;
      let payload: any = {};

      if (body.op === 'roadmap:update') {
        if (role !== 'owner' && !directGroup) await assertCanEditRoadmap(tx, user.id, roadmapId);
        const data: any = {};
        if (typeof body.payload.data?.title === 'string') data.title = body.payload.data.title.trim().slice(0, 200);
        if (typeof body.payload.data?.description === 'string') data.description = body.payload.data.description.slice(0, 5000);
        if (body.payload.data?.privacy && roadmap.ownerId === user.id) data.privacy = body.payload.data.privacy;
        if (body.payload.data?.editorState && typeof body.payload.data.editorState === 'object') data.editorState = body.payload.data.editorState;
        const updated = await tx.roadmap.update({ where: { id: roadmapId }, data, select: { id: true, ownerId: true, title: true, description: true, privacy: true, shareSlug: true, editorState: true, version: true } });
        result = { type: body.op, roadmap: updated };
        payload = { roadmap: updated };
      } else if (body.op === 'topic:create') {
        if (role !== 'owner' && !directGroup) await assertCanEditRoadmap(tx, user.id, roadmapId);
        const parentId = body.payload.parentId ?? null;
        if (parentId) {
          const parent = await tx.topic.findFirst({ where: { id: parentId, roadmapId }, select: { id: true } });
          if (!parent) throw new Error('NOT_FOUND');
        }
        const created = await tx.topic.create({ data: {
          roadmapId,
          parentId,
          title: String(body.payload.title ?? 'Untitled').trim().slice(0, 200),
          description: String(body.payload.description ?? '').slice(0, 5000),
          notes: String(body.payload.notes ?? '').slice(0, 50000),
          status: body.payload.status === 'completed' ? 'completed' : body.payload.status === 'in_progress' ? 'in_progress' : 'not_started',
          progress: Math.max(0, Math.min(100, Number(body.payload.progress ?? 0))),
          priority: Math.max(0, Math.min(5, Number(body.payload.priority ?? 0))),
          tags: Array.isArray(body.payload.tags) ? body.payload.tags.map(String).slice(0, 30) : [],
          dueDate: body.payload.dueDate ? new Date(body.payload.dueDate) : null,
          position: await nextPosition(tx, roadmapId, parentId),
        }, include: { resources: true } });
        result = { type: body.op, topic: created };
        entityType = 'topic'; entityId = created.id; payload = { topic: created };
      } else if (body.op === 'topic:update') {
        const id = String(body.payload.id);
        if (!(await canEditTopic(tx, user.id, roadmapId, id))) throw new Error('FORBIDDEN');
        const existing = await tx.topic.findFirst({ where: { id, roadmapId } });
        if (!existing) throw new Error('NOT_FOUND');
        const nextParent = body.payload.data?.parentId === undefined ? existing.parentId : (body.payload.data.parentId ?? null);
        if (nextParent === id || (nextParent && await isDescendant(tx, id, nextParent))) throw new Error('CYCLE');
        if (nextParent) {
          const p = await tx.topic.findFirst({ where: { id: nextParent, roadmapId }, select: { id: true } });
          if (!p || !(await canEditTopic(tx, user.id, roadmapId, nextParent))) throw new Error('FORBIDDEN');
        } else if (role !== 'owner' && !directGroup) {
          throw new Error('LEADER_ONLY');
        }
        const data: any = {};
        for (const key of ['title','description','notes','priority','tags']) if (body.payload.data?.[key] !== undefined) data[key] = body.payload.data[key];
        if (body.payload.data?.status !== undefined) data.status = body.payload.data.status;
        if (body.payload.data?.progress !== undefined || body.payload.data?.status !== undefined) data.progress = body.payload.data.status === 'completed' ? 100 : Number(body.payload.data.progress ?? existing.progress);
        if (body.payload.data?.dueDate !== undefined) data.dueDate = body.payload.data.dueDate ? new Date(body.payload.data.dueDate) : null;
        if (body.payload.data?.parentId !== undefined) data.parentId = nextParent;
        const updated = await tx.topic.update({ where: { id }, data, include: { resources: true } });
        result = { type: body.op, topic: updated };
        entityType = 'topic'; entityId = id; payload = { topic: updated };
      } else if (body.op === 'topic:delete') {
        const id = String(body.payload.id);
        if (!(await canEditTopic(tx, user.id, roadmapId, id))) throw new Error('FORBIDDEN');
        const existing = await tx.topic.findFirst({ where: { id, roadmapId }, select: { id: true } });
        if (!existing) throw new Error('NOT_FOUND');
        await tx.topic.delete({ where: { id } });
        result = { type: body.op, id };
        entityType = 'topic'; entityId = id; payload = { deletedId: id };
      } else if (body.op === 'resource:create') {
        const topicId = String(body.payload.topicId);
        if (!(await canEditTopic(tx, user.id, roadmapId, topicId))) throw new Error('FORBIDDEN');
        const topic = await tx.topic.findFirst({ where: { id: topicId, roadmapId }, select: { id: true } });
        if (!topic) throw new Error('NOT_FOUND');
        const resource = await tx.resource.create({ data: {
          topicId,
          title: String(body.payload.title ?? 'Resource').trim().slice(0, 300),
          url: String(body.payload.url ?? '').trim().slice(0, 2000),
          type: String(body.payload.type ?? 'other').slice(0, 80),
          notes: String(body.payload.notes ?? '').slice(0, 5000),
          completed: !!body.payload.completed,
          favorite: !!body.payload.favorite,
        } });
        result = { type: body.op, resource };
        entityType = 'resource'; entityId = resource.id; payload = { resource };
      } else if (body.op === 'resource:update') {
        const id = String(body.payload.id);
        const resource = await tx.resource.findUnique({ where: { id }, include: { topic: { select: { roadmapId: true } } } });
        if (!resource || resource.topic.roadmapId !== roadmapId) throw new Error('NOT_FOUND');
        if (!(await canEditTopic(tx, user.id, roadmapId, resource.topicId))) throw new Error('FORBIDDEN');
        const data: any = {};
        for (const key of ['title','url','type','notes','completed','favorite']) if (body.payload.data?.[key] !== undefined) data[key] = body.payload.data[key];
        const updated = await tx.resource.update({ where: { id }, data });
        result = { type: body.op, resource: updated };
        entityType = 'resource'; entityId = id; payload = { resource: updated };
      } else if (body.op === 'resource:delete') {
        const id = String(body.payload.id);
        const resource = await tx.resource.findUnique({ where: { id }, include: { topic: { select: { roadmapId: true } } } });
        if (!resource || resource.topic.roadmapId !== roadmapId) throw new Error('NOT_FOUND');
        if (!(await canEditTopic(tx, user.id, roadmapId, resource.topicId))) throw new Error('FORBIDDEN');
        await tx.resource.delete({ where: { id } });
        result = { type: body.op, id };
        entityType = 'resource'; entityId = id; payload = { deletedId: id };
      }

      const change = await recordChange(tx, roadmapId, user.id, operation, entityType, entityId, payload);
      return { ...result, ...change, actorId: user.id };
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
