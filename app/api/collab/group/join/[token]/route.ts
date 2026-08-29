import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';

function getRoadmapIds(settings: unknown, primary: string) {
  const value = (settings as any) || {};
  return Array.from(new Set([primary, ...(Array.isArray(value.roadmapIds) ? value.roadmapIds.filter((x: unknown): x is string => typeof x === 'string') : [])]));
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const user = await requireUser();
    const { token } = await params;
    const result = await withRls(user.id, async tx => {
      const group = await tx.collabGroup.findUnique({ where: { inviteToken: token }, select: { id: true, name: true, maxMembers: true, ownerId: true, roadmapId: true, settings: true } });
      if (!group) throw new Error('NOT_FOUND');
      const settings = (group.settings as any) || {};
      const kind = settings.kind === 'community' ? 'community' : 'team';
      const existing = await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } } });
      if (existing) return { alreadyMember: true, pending: false, roadmapId: group.roadmapId, groupId: group.id };
      if (kind === 'community') {
        const pending = await tx.collabGroupJoinRequest.findFirst({ where: { groupId: group.id, requesterId: user.id, status: 'pending' } });
        if (pending) return { alreadyMember: false, pending: true, roadmapId: group.roadmapId, groupId: group.id };
        const created = await tx.collabGroupJoinRequest.create({ data: { groupId: group.id, requesterId: user.id, message: 'Requested collaboration through the community invite link.' } });
        await tx.notification.create({ data: { userId: group.ownerId, type: 'collab_group_join_request', title: `Community access request`, body: `${user.fullName || user.email} requested collaboration access to ${group.name}.`, collabGroupJoinRequestId: created.id } });
        return { alreadyMember: false, pending: true, roadmapId: group.roadmapId, groupId: group.id };
      }
      await tx.$queryRaw`select id from collab_groups where id=${group.id}::uuid for update`;
      const count = await tx.collabGroupMember.count({ where: { groupId: group.id } });
      if (count >= group.maxMembers) throw new Error('GROUP_FULL');
      const role = 'editor';
      const member = await tx.collabGroupMember.create({ data: { groupId: group.id, userId: user.id, role } });
      for (const roadmapId of getRoadmapIds(group.settings, group.roadmapId)) {
        await tx.roadmapShare.upsert({ where: { roadmapId_userId: { roadmapId, userId: user.id } }, create: { roadmapId, userId: user.id, role }, update: { role } });
      }
      const others = await tx.collabGroupMember.findMany({ where: { groupId: group.id, userId: { not: user.id } }, select: { userId: true } });
      if (others.length) await tx.notification.createMany({ data: others.map((m: { userId: string }) => ({ userId: m.userId, type: 'collab_group_member_joined', title: `New member joined ${group.name}`, body: `${user.fullName || user.email} joined your team.` })) });
      return { alreadyMember: false, pending: false, roadmapId: group.roadmapId, groupId: group.id, member };
    });
    return NextResponse.json(result, { status: result.pending ? 202 : result.alreadyMember ? 200 : 201 });
  } catch (e) { return errorResponse(e); }
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const user = await requireUser();
    const { token } = await params;
    const result = await withRls(user.id, async tx => {
      const group = await tx.collabGroup.findUnique({ where: { inviteToken: token }, select: { id: true, name: true, description: true, maxMembers: true, roadmapId: true, settings: true, roadmap: { select: { title: true, privacy: true } } } });
      if (!group) throw new Error('NOT_FOUND');
      const memberCount = await tx.collabGroupMember.count({ where: { groupId: group.id } });
      const membership = await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } }, select: { role: true } });
      const pending = await tx.collabGroupJoinRequest.findFirst({ where: { groupId: group.id, requesterId: user.id, status: 'pending' }, select: { id: true } });
      return { group, memberCount, membership, pending: !!pending };
    });
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
