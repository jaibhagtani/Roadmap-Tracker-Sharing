import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { detectResourceType } from '@/lib/url-type';
import { z } from 'zod';
import { bumpUserCache, bumpPublicRoadmapCache } from '@/lib/redis';
import { getRoadmapRole } from '@/lib/collab-access';

const schema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  url: z.string().url().optional(),
  type: z.string().trim().min(1).max(50).nullable().optional(),
  notes: z.string().max(10000).optional(),
  completed: z.boolean().optional(),
  favorite: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const input = schema.parse(await req.json());
  const existing = await withRls(user.id, async tx => {
    const row = await tx.resource.findUnique({ where: { id }, include: { topic: { select: { roadmapId: true, roadmap: { select: { privacy: true } } } } } });
    if (!row) return null; const role = await getRoadmapRole(tx, user.id, row.topic.roadmapId); return ['owner','editor','contributor'].includes(role) ? row : null;
  });
  if (!existing) return new Response('Not found', { status: 404 });
  const resource = await withRls(user.id, tx => tx.resource.update({
    where: { id },
    data: { ...input, type: input.type === null ? undefined : input.type ?? (input.url ? detectResourceType(input.url) : undefined) },
  }));
  await bumpUserCache(user.id);
  if (existing.topic.roadmap.privacy === 'public') await bumpPublicRoadmapCache(existing.topic.roadmapId);
  return NextResponse.json({ resource });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const existing = await withRls(user.id, async tx => {
    const row = await tx.resource.findUnique({ where: { id }, select: { topic: { select: { roadmapId: true, roadmap: { select: { privacy: true } } } } } });
    if (!row) return null; const role = await getRoadmapRole(tx, user.id, row.topic.roadmapId); return ['owner','editor'].includes(role) ? row : null;
  });
  if (!existing) return new Response('Not found', { status: 404 });
  const deleted = await withRls(user.id, tx => tx.resource.deleteMany({ where: { id } }));
  if (!deleted.count) return new Response('Not found', { status: 404 });
  await bumpUserCache(user.id);
  if (existing.topic.roadmap.privacy === 'public') await bumpPublicRoadmapCache(existing.topic.roadmapId);
  return NextResponse.json({ ok: true });
}
