import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { getCached, setCached, userCacheKey, bumpUserCache } from '@/lib/redis';

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const ping = url.searchParams.get('ping') === '1';
  const refresh = url.searchParams.get('refresh') === '1';

  if (ping) {
    const notifications = await withRls(user.id, tx => tx.notification.findMany({ where: { userId: user.id, readAt: null }, select: { id: true }, take: 100 }));
    return NextResponse.json({ unreadCount: notifications.length, serverTime: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const key = await userCacheKey(user.id, 'notifications-v2');
  if (!refresh) {
    const cached = await getCached<any[]>(key);
    if (cached) return NextResponse.json({ notifications: cached, cached: true });
  }
  const rawNotifications = await withRls(user.id, tx => tx.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      roadmap: { select: { id: true, shareSlug: true, privacy: true } },
      shareRequest: { select: { roadmapId: true, roadmap: { select: { id: true, shareSlug: true, privacy: true } } } },
      collabGroupJoinRequest: { select: { group: { select: { roadmapId: true, roadmap: { select: { id: true, shareSlug: true, privacy: true } } } } } },
      collabCommit: { select: { branch: { select: { roadmapId: true, roadmap: { select: { id: true, shareSlug: true, privacy: true } } } } } },
    },
  }));
  const notifications = rawNotifications.map((n: any) => {
    const roadmap = n.roadmap || n.shareRequest?.roadmap || n.collabGroupJoinRequest?.group?.roadmap || n.collabCommit?.branch?.roadmap || null;
    const roadmapId = roadmap?.id || n.roadmapId || n.shareRequest?.roadmapId || n.collabGroupJoinRequest?.group?.roadmapId || n.collabCommit?.branch?.roadmapId || null;
    return { ...n, roadmapId, roadmapShareSlug: roadmap?.shareSlug || null, roadmapPrivacy: roadmap?.privacy || null };
  });
  await setCached(key, notifications, 60);
  return NextResponse.json({ notifications, cached: false }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const n = await withRls(user.id, tx => body.id
    ? tx.notification.updateMany({ where: { id: body.id, userId: user.id }, data: { readAt: new Date() } })
    : tx.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } }));
  await bumpUserCache(user.id);
  return NextResponse.json({ count: n.count });
}
