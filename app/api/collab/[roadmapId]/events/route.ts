import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { withRls } from '@/lib/db';
import { getRoadmapRole } from '@/lib/collab-access';

export async function GET(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const since = Number(new URL(req.url).searchParams.get('since') || 0);
    const data = await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role === 'none') throw new Error('FORBIDDEN');
      const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { version: true, updatedAt: true } });
      if (!roadmap) throw new Error('NOT_FOUND');
      const events = await tx.collaborationEvent.findMany({
        where: { roadmapId, version: { gt: Number.isFinite(since) ? since : 0 } },
        orderBy: { version: 'asc' },
        take: 200,
        select: { id: true, actorId: true, version: true, operation: true, entityType: true, entityId: true, payload: true, createdAt: true },
      });
      return { version: roadmap.version, updatedAt: roadmap.updatedAt, events };
    });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(message, { status: message === 'FORBIDDEN' ? 403 : message === 'NOT_FOUND' ? 404 : 400 });
  }
}
