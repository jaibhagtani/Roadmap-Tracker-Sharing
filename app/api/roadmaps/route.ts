import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { z } from 'zod';
import { getCached, setCached, userCacheKey, bumpUserCache, bumpPublicRoadmapCache } from '@/lib/redis';

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).default(''),
  privacy: z.enum(['private', 'link', 'public']).default('private'),
});

export async function GET() {
  const user = await requireUser();
  const key = await userCacheKey(user.id, 'roadmaps');
  const cached = await getCached<any[]>(key);
  if (cached) return NextResponse.json({ roadmaps: cached, cached: true });
  const roadmaps = await withRls(user.id, tx => tx.roadmap.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { topics: true } } },
  }));
  await setCached(key, roadmaps, 20);
  return NextResponse.json({ roadmaps, cached: false });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const input = createSchema.parse(await req.json());
  const roadmap = await withRls(user.id, tx => tx.roadmap.create({
    data: { ownerId: user.id, title: input.title, description: input.description, privacy: input.privacy },
  }));
  await withRls(user.id, tx => tx.profile.upsert({
    where: { id: user.id },
    create: { id: user.id, fullName: user.fullName || user.email.split('@')[0] },
    update: {},
  }).then(() => null));
  await bumpUserCache(user.id);
  return NextResponse.json({ roadmap }, { status: 201 });
}
