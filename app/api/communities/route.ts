import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { getCached, setCached, publicCacheKey } from '@/lib/redis';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
    const key = publicCacheKey('communities-base', q.toLowerCase().replace(/\s+/g, ' '));
    type CommunityGroup = { id: string; name: string; description: string; maxMembers: number; ownerId: string; settings: unknown; roadmap: { id: string; title: string; description: string; privacy: string } | null; _count: { members: number } };
    const cachedGroups = await getCached<CommunityGroup[]>(key);
    const groups: CommunityGroup[] = cachedGroups ?? await withRls(user.id, tx => tx.collabGroup.findMany({
      where: { discoverable: true, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { roadmap: { title: { contains: q, mode: 'insensitive' } } }] } : {}) },
      orderBy: { createdAt: 'desc' }, take: 60,
      include: { roadmap: { select: { id: true, title: true, description: true, privacy: true } }, _count: { select: { members: true } } },
    }));
    if (!cachedGroups) await setCached(key, groups, 20);
    const membershipRows = await withRls(user.id, async tx => Promise.all(groups.map(async (group: CommunityGroup) => ({
      membership: await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } }, select: { role: true } }),
      pending: !!await tx.collabGroupJoinRequest.findFirst({ where: { groupId: group.id, requesterId: user.id, status: 'pending' }, select: { id: true } }),
    }))));
    const rows = groups.map((group: CommunityGroup, index: number) => {
      const settings = (group.settings as any) || {};
      const kind = settings.kind === 'community' ? 'community' : 'team';
      return { id: group.id, name: group.name, description: group.description, maxMembers: group.maxMembers, memberCount: group._count.members, ownerId: group.ownerId, isOwner: group.ownerId === user.id, kind, accessMode: settings.accessMode || (kind === 'community' ? 'request' : 'invite'), directCollaboration: settings.directCollaboration !== false || kind === 'community', roadmap: group.roadmap, membership: membershipRows[index].membership, pending: membershipRows[index].pending };
    });
    return NextResponse.json({ groups: rows, cached: true });
  } catch (e) { return errorResponse(e); }
}
