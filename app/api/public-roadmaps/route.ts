import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCached, publicCacheKey, setCached } from '@/lib/redis';
import { requireUser } from '@/lib/server-auth';

export async function GET(req: Request) {
  await requireUser();
  const q = new URL(req.url).searchParams.get('q')?.trim() || '';
  const key = publicCacheKey('public-roadmaps', q.toLowerCase().replace(/\s+/g, ' '));
  const cached = await getCached<any[]>(key);
  if (cached !== null) return NextResponse.json({ roadmaps: cached, cached: true });
  const roadmaps = await db.roadmap.findMany({
    where: { privacy: 'public', ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { topics: { some: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { tags: { has: q } }] } } }] } : {}) },
    orderBy: { updatedAt: 'desc' }, take: 60,
    select: { id: true, title: true, description: true, updatedAt: true, shareSlug: true, _count: { select: { topics: true } }, communityGroup: { select: { id: true, name: true, maxMembers: true, _count: { select: { members: true } } } } },
  });
  await setCached(key, roadmaps, 30);
  return NextResponse.json({ roadmaps, cached: false });
}
