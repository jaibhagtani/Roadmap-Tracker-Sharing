import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { bumpUserCache } from '@/lib/redis';
import { cloneRoadmap } from '@/lib/roadmap-clone';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { notificationId } = await req.json();
    if (!notificationId) throw new Error('NOTIFICATION_REQUIRED');

    const cloned = await withRls(user.id, async tx => {
      const n = await tx.notification.findFirst({
        where: { id: String(notificationId), userId: user.id },
        include: {
          roadmap: { select: { id: true } },
          shareRequest: { select: { roadmapId: true } },
          collabGroupJoinRequest: { select: { group: { select: { roadmapId: true } } } },
          collabCommit: { select: { branch: { select: { roadmapId: true } } } },
        },
      });
      if (!n) throw new Error('NOT_FOUND');

      const roadmapId = n.roadmap?.id || n.shareRequest?.roadmapId || n.collabGroupJoinRequest?.group?.roadmapId || n.collabCommit?.branch?.roadmapId;
      if (!roadmapId) throw new Error('ROADMAP_NOT_FOUND');

      const source = await tx.roadmap.findUnique({
        where: { id: roadmapId },
        include: {
          topics: { include: { resources: true }, orderBy: [{ parentId: 'asc' }, { position: 'asc' }] },
          goals: true,
          todos: { orderBy: [{ todoDate: 'asc' }, { position: 'asc' }] },
        },
      });
      if (!source) throw new Error('ROADMAP_NOT_FOUND');
      if (source.ownerId === user.id) throw new Error('ALREADY_OWNER');

      const directShare = await tx.roadmapShare.findUnique({ where: { roadmapId_userId: { roadmapId, userId: user.id } } });
      if (source.privacy === 'private' && !directShare) throw new Error('FORBIDDEN');
      if (source.privacy !== 'private' && !directShare && !['public', 'link'].includes(source.privacy)) throw new Error('FORBIDDEN');

      return cloneRoadmap(tx, source, user.id);
    });

    await bumpUserCache(user.id);
    return NextResponse.json({ ok: true, roadmap: cloned }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
