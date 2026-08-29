import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { z } from 'zod';
import { bumpUserCache, bumpPublicRoadmapCache } from '@/lib/redis';
import { getRoadmapRole } from '@/lib/collab-access';

const schema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(5000).optional(),
  notes: z.string().max(50000).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  priority: z.number().int().min(0).max(5).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  dueDate: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

async function isDescendant(tx: any, rootId: string, candidateId: string) {
  let current = await tx.topic.findUnique({ where: { id: candidateId }, select: { parentId: true } });
  for (let i = 0; i < 1000 && current?.parentId; i += 1) {
    if (current.parentId === rootId) return true;
    current = await tx.topic.findUnique({ where: { id: current.parentId }, select: { parentId: true } });
  }
  return false;
}

async function reorder(tx: any, topicId: string, roadmapId: string, oldParentId: string | null, newParentId: string | null, requestedPosition?: number) {
  const oldSiblings = await tx.topic.findMany({ where: { roadmapId, parentId: oldParentId, id: { not: topicId } }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  let target = requestedPosition ?? oldSiblings.length;
  if (target < 0) target = 0;
  if (target > oldSiblings.length) target = oldSiblings.length;

  if (oldParentId !== newParentId) {
    let i = 0;
    for (const sibling of oldSiblings) { await tx.topic.update({ where: { id: sibling.id }, data: { position: i++ } }); }
    const newSiblings = await tx.topic.findMany({ where: { roadmapId, parentId: newParentId, id: { not: topicId } }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
    target = Math.min(target, newSiblings.length);
    await tx.topic.update({ where: { id: topicId }, data: { position: 0 } });
    const ordered = [...newSiblings.slice(0, target), { id: topicId }, ...newSiblings.slice(target)];
    for (let i = 0; i < ordered.length; i++) await tx.topic.update({ where: { id: ordered[i].id }, data: { position: i } });
    return;
  }

  const ordered = [...oldSiblings];
  ordered.splice(Math.min(target, ordered.length), 0, { id: topicId });
  for (let i = 0; i < ordered.length; i++) await tx.topic.update({ where: { id: ordered[i].id }, data: { position: i } });
}

async function reorderDeletedSiblings(tx: any, roadmapId: string, parentId: string | null) {
  const siblings = await tx.topic.findMany({ where: { roadmapId, parentId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  for (let i = 0; i < siblings.length; i++) await tx.topic.update({ where: { id: siblings[i].id }, data: { position: i } });
}

async function recalcAncestors(tx: any, roadmapId: string, startParentId: string | null) {
  let parentId = startParentId;
  for (let i = 0; i < 1000 && parentId; i += 1) {
    const children = await tx.topic.findMany({ where: { roadmapId, parentId }, select: { progress: true, status: true } });
    if (!children.length) break;
    const progress = Math.round(children.reduce((sum: number, child: {progress:number}) => sum + child.progress, 0) / children.length);
    const completed = children.every((c: {status:string;progress:number}) => c.status === 'completed' || c.progress === 100);
    const status = completed ? 'completed' : progress > 0 ? 'in_progress' : 'not_started';
    const parent = await tx.topic.update({ where: { id: parentId }, data: { progress, status } });
    parentId = parent.parentId;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const input = schema.parse(await req.json());
  const roadmapMeta = await withRls(user.id, async tx => {
    const existing = await tx.topic.findUnique({ where: { id }, select: { roadmapId: true, roadmap: { select: { privacy: true } } } });
    if (!existing) return null;
    const role = await getRoadmapRole(tx, user.id, existing.roadmapId);
    return ['owner','editor','contributor'].includes(role) ? { ...existing, role } : null;
  });
  if (!roadmapMeta) return new Response('Not found', { status: 404 });
  const topic = await withRls(user.id, async tx => {
    const existing = await tx.topic.findFirst({ where: { id, roadmapId: roadmapMeta.roadmapId } });
    if (!existing) throw new Error('NOT_FOUND');
    const nextParent = input.parentId === undefined ? existing.parentId : input.parentId;
    if (nextParent === id) throw new Error('SELF_PARENT');
    if (nextParent && await isDescendant(tx, id, nextParent)) throw new Error('CYCLE');
    if (nextParent) {
      const parent = await tx.topic.findFirst({ where: { id: nextParent, roadmapId: existing.roadmapId } });
      if (!parent) throw new Error('NOT_FOUND');
    }

    const requestedPosition = input.position;
    const data: any = {
      title: input.title, parentId: input.parentId, description: input.description, notes: input.notes,
      priority: input.priority, tags: input.tags,
      dueDate: input.dueDate === undefined ? undefined : input.dueDate === null ? null : new Date(input.dueDate),
    };
    if (input.status !== undefined) data.status = input.status;
    if (input.progress !== undefined || input.status !== undefined) data.progress = input.status === 'completed' ? 100 : input.progress ?? existing.progress;
    if (input.position !== undefined) data.position = existing.position;
    if (input.parentId === undefined) delete data.parentId;

    const updated = await tx.topic.update({ where: { id }, data });
    if (nextParent !== existing.parentId || requestedPosition !== undefined) {
      await reorder(tx, id, existing.roadmapId, existing.parentId, nextParent, requestedPosition);
    }
    await recalcAncestors(tx, existing.roadmapId, existing.parentId);
    if (nextParent !== existing.parentId) await recalcAncestors(tx, existing.roadmapId, nextParent);
    return tx.topic.findUnique({ where: { id: updated.id }, include: { resources: { orderBy: { createdAt: 'asc' } } } });
  });
  await bumpUserCache(user.id);
  if (roadmapMeta.roadmap.privacy === 'public') await bumpPublicRoadmapCache(roadmapMeta.roadmapId);
  return NextResponse.json({ topic });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const parentId = await withRls(user.id, async tx => {
    const topic = await tx.topic.findUnique({ where: { id }, select: { roadmapId: true, parentId: true, roadmap: { select: { privacy: true } } } });
    if (!topic) return null;
    const role = await getRoadmapRole(tx, user.id, topic.roadmapId);
    return ['owner','editor'].includes(role) ? topic : null;
  });
  if (!parentId) return new Response('Not found', { status: 404 });
  await withRls(user.id, async tx => {
    await tx.topic.delete({ where: { id } });
    await reorderDeletedSiblings(tx, parentId.roadmapId, parentId.parentId);
    await recalcAncestors(tx, parentId.roadmapId, parentId.parentId);
  });
  await bumpUserCache(user.id);
  if (parentId.roadmap.privacy === 'public') await bumpPublicRoadmapCache(parentId.roadmapId);
  return NextResponse.json({ ok: true });
}
