import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { hasTopicAccess } from '@/lib/collab-access';
import { bumpUserCache } from '@/lib/redis';

const schema = z.object({ status: z.enum(['learning','done','skipped']) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await withRls(user.id, async tx => {
      const topic = await tx.topic.findUnique({ where: { id }, select: { id: true, roadmapId: true, roadmap: { select: { privacy: true } } } });
      if (!topic) throw new Error('NOT_FOUND');
      const allowed = topic.roadmap.privacy === 'public' || await hasTopicAccess(tx, user.id, topic.roadmapId, id);
      if (!allowed) throw new Error('FORBIDDEN');
      return tx.userTopicProgress.findUnique({ where: { userId_topicId: { userId: user.id, topicId: id } }, select: { status: true, updatedAt: true } });
    });
    return NextResponse.json({ progress: result ?? { status: 'learning', updatedAt: null } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = schema.parse(await req.json());
    const progress = await withRls(user.id, async tx => {
      const topic = await tx.topic.findUnique({ where: { id }, select: { id: true, roadmapId: true, roadmap: { select: { privacy: true } } } });
      if (!topic) throw new Error('NOT_FOUND');
      const allowed = topic.roadmap.privacy === 'public' || await hasTopicAccess(tx, user.id, topic.roadmapId, id);
      if (!allowed) throw new Error('FORBIDDEN');
      return tx.userTopicProgress.upsert({
        where: { userId_topicId: { userId: user.id, topicId: id } },
        update: { status: input.status },
        create: { userId: user.id, topicId: id, status: input.status },
        select: { status: true, updatedAt: true },
      });
    });
    await bumpUserCache(user.id);
    return NextResponse.json({ progress });
  } catch (e) { return errorResponse(e); }
}
