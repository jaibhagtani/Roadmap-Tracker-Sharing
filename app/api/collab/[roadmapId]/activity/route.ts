import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { getRoadmapRole } from '@/lib/collab-access';

export async function GET(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const events = await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role === 'none') throw new Error('FORBIDDEN');
      return tx.collaborationEvent.findMany({ where: { roadmapId }, orderBy: { createdAt: 'desc' }, take: 40 });
    });
    return NextResponse.json({ events }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
