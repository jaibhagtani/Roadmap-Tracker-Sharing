import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCached, setCached, publicCacheKey } from '@/lib/redis';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const forceSync = new URL(_req.url).searchParams.get('sync') === '1';
  const root = await db.topic.findUnique({ where: { shareToken: token }, select: { id: true, roadmapId: true, title: true } });
  if (!root) return new Response('Not found', { status: 404 });
  const cacheKey = publicCacheKey('topic-share', token);
  if (!forceSync) {
    const cached = await getCached<any>(cacheKey);
    if (cached) return NextResponse.json({ share: cached, cached: true });
  }

  const [roadmap, topics] = await Promise.all([
    db.roadmap.findUnique({ where: { id: root.roadmapId }, select: { id: true, title: true, description: true, shareSlug: true, privacy: true, editorState: true } }),
    db.topic.findMany({ where: { roadmapId: root.roadmapId }, include: { resources: true }, orderBy: [{ parentId: 'asc' }, { position: 'asc' }] }),
  ]);
  if (!roadmap) return new Response('Not found', { status: 404 });
  const visible = new Set<string>([root.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of topics) {
      if (t.parentId && visible.has(t.parentId) && !visible.has(t.id)) { visible.add(t.id); changed = true; }
    }
  }
  const share = { token, rootTopicId: root.id, roadmap, rootTitle: root.title, topics: topics.filter((t: { id: string }) => visible.has(t.id)) };
  await setCached(cacheKey, share, 30);
  return NextResponse.json({ share, cached: false });
}
