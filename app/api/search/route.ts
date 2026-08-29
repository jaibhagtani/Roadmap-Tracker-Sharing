import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { getCached, setCached, userCacheKey } from '@/lib/redis';

export async function GET(req: Request) {
  const user = await requireUser();
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json({ topics: [], resources: [] });
  const key = await userCacheKey(user.id, 'search', q.toLowerCase().replace(/\s+/g, ' '));
  const cached = await getCached<any>(key);
  if (cached) return NextResponse.json({ ...cached, cached: true });
  const result = await withRls(user.id, async tx => {
    const topics = await tx.topic.findMany({ where: { roadmap: { ownerId: user.id }, OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { notes: { contains: q, mode: 'insensitive' } }] }, take: 20, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, roadmapId: true } });
    const resources = await tx.resource.findMany({ where: { topic: { roadmap: { ownerId: user.id } }, OR: [{ title: { contains: q, mode: 'insensitive' } }, { url: { contains: q, mode: 'insensitive' } }, { notes: { contains: q, mode: 'insensitive' } }] }, take: 20, select: { id: true, title: true, url: true, topicId: true } });
    return { topics, resources };
  });
  await setCached(key, result, 15);
  return NextResponse.json({ ...result, cached: false });
}
