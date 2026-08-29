import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { z } from 'zod';
import { getRoadmapRole } from '@/lib/collab-access';
import { getCached, setCached, userCacheKey, bumpUserCache, bumpPublicRoadmapCache } from '@/lib/redis';

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  privacy: z.enum(['private', 'link', 'public']).optional(),
  editorState: z.record(z.string(), z.any()).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const forceSync = new URL(_req.url).searchParams.get('sync') === '1';
  const key = await userCacheKey(user.id, `roadmap-v2:${id}`);
  if (!forceSync) {
    const cached = await getCached<any>(key);
    if (cached) return NextResponse.json({ roadmap: cached, cached: true });
  }
  const result = await withRls(user.id, async tx => {
    const roadmap = await tx.roadmap.findUnique({ where: { id }, include: { topics: { orderBy: [{ parentId: 'asc' }, { position: 'asc' }], include: { resources: { orderBy: { createdAt: 'asc' } } } } } });
    if (!roadmap) return null;
    if (roadmap.ownerId === user.id) return { roadmap, role: 'owner' as const };
    const role = await getRoadmapRole(tx, user.id, id);
    if (role === 'none') return null;
    return { roadmap, role: role as 'viewer'|'contributor'|'editor' };
  });
  if (!result) return new Response('Not found', { status: 404 });
  await setCached(key, result, 20);
  return NextResponse.json({ roadmap: result.roadmap, accessRole: result.role, cached: false });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const input = updateSchema.parse(await req.json());
  const access = await withRls(user.id, async tx => {
    const roadmap = await tx.roadmap.findUnique({ where: { id }, select: { id: true, ownerId: true, privacy: true } });
    if (!roadmap) return null;
    if (roadmap.ownerId === user.id) return { roadmap, role: 'owner' as const };
    const role = await getRoadmapRole(tx, user.id, id);
    if (!['editor','contributor'].includes(role)) return null;
    return { roadmap, role };
  });
  if (!access) return new Response('Not found', { status: 404 });
  const updated = await withRls(user.id, async tx => {
    const communityGroup = await tx.collabGroup.findUnique({ where: { roadmapId: id }, select: { settings: true } });
    const settings = communityGroup?.settings && typeof communityGroup.settings === 'object' ? communityGroup.settings as Record<string, unknown> : {};
    const isCommunity = settings.kind === 'community';
    const data = isCommunity ? { ...input, privacy: 'public' as const } : input;
    return tx.roadmap.update({ where: { id }, data: { ...data, editorState: data.editorState as any } });
  });
  const roadmap = access.roadmap;
  await bumpUserCache(user.id);
  if (roadmap.privacy === 'public' || updated.privacy === 'public') await bumpPublicRoadmapCache(id);
  return NextResponse.json({ roadmap: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const existing = await withRls(user.id, tx => tx.roadmap.findFirst({ where: { id, ownerId: user.id }, select: { id: true, privacy: true } }));
  if (!existing) return new Response('Not found', { status: 404 });
  const deleted = await withRls(user.id, tx => tx.roadmap.deleteMany({ where: { id, ownerId: user.id } }));
  if (!deleted.count) return new Response('Not found', { status: 404 });
  await bumpUserCache(user.id);
  if (existing.privacy === 'public') await bumpPublicRoadmapCache(existing.id);
  return NextResponse.json({ ok: true });
}
