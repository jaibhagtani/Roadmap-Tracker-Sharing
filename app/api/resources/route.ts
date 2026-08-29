import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { detectResourceType } from '@/lib/url-type';
import { z } from 'zod';
import { bumpUserCache, bumpPublicRoadmapCache } from '@/lib/redis';
import { getRoadmapRole } from '@/lib/collab-access';

const schema = z.object({
  topicId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  url: z.string().url(),
  type: z.string().trim().min(1).max(50).optional(),
  notes: z.string().max(10000).default(''),
  completed: z.boolean().default(false),
  favorite: z.boolean().default(false),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const input = schema.parse(await req.json());
  const { resource, roadmapMeta } = await withRls(user.id, async tx => {
    const topic = await tx.topic.findUnique({ where: { id: input.topicId }, select: { id: true, roadmapId: true, roadmap: { select: { privacy: true } } } });
    if (!topic) throw new Error('NOT_FOUND');
    const role = await getRoadmapRole(tx, user.id, topic.roadmapId);
    if (!['owner','editor','contributor'].includes(role)) throw new Error('FORBIDDEN');
    const resource = await tx.resource.create({ data: { ...input, type: input.type || detectResourceType(input.url) } });
    return { resource, roadmapMeta: { roadmapId: topic.roadmapId, privacy: topic.roadmap.privacy } };
  });
  await bumpUserCache(user.id);
  if (roadmapMeta.privacy === 'public') await bumpPublicRoadmapCache(roadmapMeta.roadmapId);
  return NextResponse.json({ resource }, { status: 201 });
}
