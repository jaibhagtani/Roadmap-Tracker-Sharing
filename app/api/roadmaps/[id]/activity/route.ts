import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { bumpPublicRoadmapCache, bumpUserCache } from '@/lib/redis';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const existing = await withRls(user.id, tx => tx.roadmap.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true, privacy: true },
  }));
  if (!existing) return new Response('Not found', { status: 404 });

  const updated = await withRls(user.id, tx => tx.roadmap.update({
    where: { id },
    data: { updatedAt: new Date() },
    select: { id: true, updatedAt: true },
  }));

  await bumpUserCache(user.id);
  if (existing.privacy === 'public') await bumpPublicRoadmapCache(id);
  return NextResponse.json({ ok: true, lastActivityAt: updated.updatedAt });
}
