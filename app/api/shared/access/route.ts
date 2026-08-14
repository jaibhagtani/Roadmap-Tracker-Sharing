import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';

export async function GET(req: Request) {
  const user = await requireUser();
  const id = new URL(req.url).searchParams.get('roadmapId');
  if (!id) return new Response('roadmapId required', { status: 400 });

  const data = await withRls(user.id, async (tx: any) => {
    const roadmap = await tx.roadmap.findUnique({
      where: { id },
      include: { topics: { include: { resources: true }, orderBy: { position: 'asc' } } },
    });
    if (!roadmap) return null;

    const wholeOwner = roadmap.ownerId === user.id;
    const wholeShare = await tx.roadmapShare.findFirst({ where: { roadmapId: id, userId: user.id } });
    const roots = await tx.topicShare.findMany({ where: { userId: user.id, topic: { roadmapId: id } }, select: { topicId: true } });
    const granted: Set<string> = new Set(roots.map((x: any) => String(x.topicId)));
    let topics = roadmap.topics;
    const pending: string[] = Array.from(granted);
    if (!wholeOwner && !wholeShare) {
      const visible = new Set<string>();
      while (pending.length) {
        const x = pending.pop()!;
        if (visible.has(x)) continue;
        visible.add(x);
        for (const t of roadmap.topics) if (t.parentId === x) pending.push(t.id);
      }
      topics = roadmap.topics.filter((t: any) => visible.has(t.id));
    }

    return { roadmap: { ...roadmap, topics }, access: wholeOwner ? 'owner' : wholeShare ? 'roadmap' : 'topic' };
  });

  if (!data) return new Response('Not found', { status: 404 });
  return NextResponse.json(data);
}
