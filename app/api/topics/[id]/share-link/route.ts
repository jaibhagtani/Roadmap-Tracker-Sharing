import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { withRls } from '@/lib/db';
import { getRoadmapRole } from '@/lib/collab-access';
import { bumpPublicRoadmapCache, delCached, publicCacheKey } from '@/lib/redis';
import { randomBytes } from 'node:crypto';

function token() { return randomBytes(24).toString('base64url'); }

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const topic = await withRls(user.id, async tx => {
      const row = await tx.topic.findUnique({ where: { id }, select: { id: true, title: true, roadmapId: true, shareToken: true } });
      if (!row) throw new Error('NOT_FOUND');
      const role = await getRoadmapRole(tx, user.id, row.roadmapId);
      if (role !== 'owner') throw new Error('FORBIDDEN');
      if (row.shareToken) return row;
      return tx.topic.update({ where: { id }, data: { shareToken: token() }, select: { id: true, title: true, shareToken: true } });
    });
    const roadmapId = await withRls(user.id, tx => tx.topic.findUnique({ where: { id }, select: { roadmapId: true } }));
    if (roadmapId?.roadmapId) await bumpPublicRoadmapCache(roadmapId.roadmapId);
    return NextResponse.json({ topic, path: `/share/topic/${topic.shareToken}` });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return new Response(message, { status: message === 'NOT_FOUND' ? 404 : message === 'FORBIDDEN' ? 403 : 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await withRls(user.id, async tx => {
      const row = await tx.topic.findUnique({ where: { id }, select: { id: true, roadmapId: true, shareToken: true } });
      if (!row) throw new Error('NOT_FOUND');
      const role = await getRoadmapRole(tx, user.id, row.roadmapId);
      if (role !== 'owner') throw new Error('FORBIDDEN');
      await tx.topic.update({ where: { id }, data: { shareToken: null } });
      if (row.shareToken) await delCached(publicCacheKey('topic-share', row.shareToken));
    });
    const roadmapId = await withRls(user.id, tx => tx.topic.findUnique({ where: { id }, select: { roadmapId: true } }));
    if (roadmapId?.roadmapId) await bumpPublicRoadmapCache(roadmapId.roadmapId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return new Response(message, { status: message === 'NOT_FOUND' ? 404 : message === 'FORBIDDEN' ? 403 : 400 });
  }
}
