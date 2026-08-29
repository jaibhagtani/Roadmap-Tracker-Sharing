import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCached, publicCacheKey, setCached } from '@/lib/redis';
import { buildChatReply, rankPublicContent, type ChatRecommendation } from '@/lib/public-chat';
import { z } from 'zod';

const schema = z.object({ message: z.string().trim().min(1).max(500) });

export async function POST(req: Request) {
  const input = schema.parse(await req.json());
  const normalized = input.message.toLowerCase().replace(/\s+/g, ' ').trim();
  const cacheKey = publicCacheKey('chatbot:recommendations', normalized.replace(/[^a-z0-9]+/g, '-').slice(0, 120));
  const cached = await getCached<{ reply: string; recommendations: ChatRecommendation[] }>(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, max-age=20' } });

  const [roadmaps, resources] = await Promise.all([
    db.roadmap.findMany({
      where: { privacy: 'public' },
      orderBy: { updatedAt: 'desc' },
      take: 250,
      select: { id: true, title: true, description: true },
    }),
    db.resource.findMany({
      where: { topic: { roadmap: { privacy: 'public' } } },
      orderBy: { createdAt: 'desc' },
      take: 250,
      select: { id: true, title: true, url: true, type: true, notes: true, topicId: true, topic: { select: { title: true, tags: true, roadmap: { select: { id: true, title: true } } } } },
    }),
  ]);

  const items: ChatRecommendation[] = [
    ...roadmaps.map((r: { id: string; title: string; description: string }) => ({ kind: 'roadmap' as const, roadmapId: r.id, roadmapTitle: r.title, title: r.title, description: r.description })),
    ...resources.map((r: { id: string; title: string; url: string; type: string; notes: string; topicId: string; topic: { title: string; roadmap: { id: string; title: string } } }) => ({ kind: 'resource' as const, roadmapId: r.topic.roadmap.id, roadmapTitle: r.topic.roadmap.title, title: r.title, description: r.notes || `${r.type} resource`, url: r.url, topicId: r.topicId, topicTitle: r.topic.title })),
  ];
  const recommendations = rankPublicContent(normalized, items, 8);
  const payload = { reply: buildChatReply(normalized, recommendations), recommendations };
  await setCached(cacheKey, payload, 60);
  return NextResponse.json(payload);
}
