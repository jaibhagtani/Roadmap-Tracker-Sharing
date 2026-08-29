import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { getRoadmapRole, recordChange } from '@/lib/collab-access';

const bodySchema = z.object({ scope: z.enum(['roadmap', 'topic']), userId: z.string().min(1).max(255), topicId: z.string().uuid().nullable().default(null) });

export async function GET(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const data = await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role !== 'owner' && role !== 'editor') throw new Error('FORBIDDEN');
      const [roadmapMembers, topicMembers] = await Promise.all([
        tx.roadmapShare.findMany({ where: { roadmapId }, orderBy: { createdAt: 'asc' } }),
        tx.topicShare.findMany({ where: { topic: { roadmapId } }, include: { topic: { select: { id: true, title: true } } }, orderBy: { createdAt: 'asc' } }),
      ]);
      return { roadmapMembers, topicMembers };
    });
    return NextResponse.json(data);
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const input = bodySchema.parse(await req.json());
    await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role !== 'owner' && role !== 'editor') throw new Error('FORBIDDEN');
      if (input.scope === 'roadmap') {
        await tx.roadmapShare.deleteMany({ where: { roadmapId, userId: input.userId } });
      } else if (input.topicId) {
        await tx.topicShare.deleteMany({ where: { topicId: input.topicId, userId: input.userId } });
      } else throw new Error('TOPIC_REQUIRED');
      await recordChange(tx, roadmapId, user.id, 'access:revoke', 'access', null, { scope: input.scope, userId: input.userId, topicId: input.topicId });
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
