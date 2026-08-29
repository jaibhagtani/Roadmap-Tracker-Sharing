import { NextResponse } from 'next/server';
import { withRls, errorResponse } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { bumpUserCache } from '@/lib/redis';
import { cloneRoadmap } from '@/lib/roadmap-clone';

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser();
    const { slug } = await params;

    const result = await withRls(user.id, async tx => {
      const source = await tx.roadmap.findFirst({
        where: { shareSlug: slug, privacy: { in: ['public', 'link'] } },
        include: {
          topics: { include: { resources: true }, orderBy: [{ parentId: 'asc' }, { position: 'asc' }] },
          goals: true,
          todos: { orderBy: [{ todoDate: 'asc' }, { position: 'asc' }] },
        },
      });
      if (!source) throw new Error('NOT_FOUND');
      if (source.ownerId === user.id) throw new Error('ALREADY_OWNER');
      return cloneRoadmap(tx, source, user.id);
    });

    await bumpUserCache(user.id);
    return NextResponse.json({ ok: true, roadmap: result }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
