import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { z } from 'zod';
import { bumpUserCache, bumpPublicRoadmapCache } from '@/lib/redis';
import { getRoadmapRole } from '@/lib/collab-access';

const schema = z.object({
  roadmapId: z.string().uuid(),
  parentId: z.string().uuid().nullable().default(null),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).default(''),
  notes: z.string().max(50000).default(''),
  status: z.enum(['not_started', 'in_progress', 'completed']).default('not_started'),
  progress: z.number().int().min(0).max(100).default(0),
  priority: z.number().int().min(0).max(5).default(0),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  dueDate: z.string().nullable().default(null),
});

async function nextPosition(tx: any, roadmapId: string, parentId: string | null) {
  const max = await tx.topic.aggregate({ where: { roadmapId, parentId }, _max: { position: true } });
  return (max._max.position ?? -1) + 1;
}

export async function POST(req: Request) {
  const user = await requireUser();
  const input = schema.parse(await req.json());
  const topic = await withRls(user.id, async tx => {
    const roadmap = await tx.roadmap.findUnique({ where: { id: input.roadmapId }, select: { id: true, ownerId: true, privacy: true } });
    if (!roadmap) throw new Error('NOT_FOUND');
    const role = await getRoadmapRole(tx, user.id, input.roadmapId);
    if (!['owner','editor','contributor'].includes(role)) throw new Error('FORBIDDEN');
    if (input.parentId) {
      const parent = await tx.topic.findFirst({ where: { id: input.parentId, roadmapId: input.roadmapId } });
      if (!parent) throw new Error('NOT_FOUND');
    }
    const childAwareProgress = input.status === 'completed' ? 100 : input.progress;
    const topic = await tx.topic.create({ data: {
      roadmapId: input.roadmapId, parentId: input.parentId, title: input.title, description: input.description,
      notes: input.notes, status: input.status === 'completed' ? 'completed' : input.status,
      progress: childAwareProgress, priority: input.priority, tags: input.tags,
      dueDate: input.dueDate ? new Date(input.dueDate) : null, position: await nextPosition(tx, input.roadmapId, input.parentId),
    }});
    if (input.parentId) {
      const inherited = await tx.topicShare.findMany({ where: { topicId: input.parentId } });
      if (inherited.length) await tx.topicShare.createMany({ data: inherited.map((grant:any) => ({ topicId: topic.id, userId: grant.userId })), skipDuplicates: true });
    }
    return topic;
  });
  await bumpUserCache(user.id);
  const roadmap = await withRls(user.id, tx => tx.roadmap.findUnique({ where: { id: topic.roadmapId }, select: { privacy: true } }));
  if (roadmap?.privacy === 'public') await bumpPublicRoadmapCache(topic.roadmapId);
  return NextResponse.json({ topic }, { status: 201 });
}
