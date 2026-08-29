import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { getRoadmapRole } from '@/lib/collab-access';

export async function GET(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const people = await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role === 'none') throw new Error('FORBIDDEN');
      const since = new Date(Date.now() - 2 * 60 * 1000);
      return tx.collaborationPresence.findMany({ where: { roadmapId, lastSeen: { gte: since } }, orderBy: { lastSeen: 'desc' }, select: { userId: true, lastSeen: true } });
    });
    return NextResponse.json({ people }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role === 'none') throw new Error('FORBIDDEN');
      await tx.collaborationPresence.upsert({ where: { roadmapId_userId: { roadmapId, userId: user.id } }, create: { roadmapId, userId: user.id }, update: { lastSeen: new Date() } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
