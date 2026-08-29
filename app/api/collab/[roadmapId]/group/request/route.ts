import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { findGroupForRoadmap } from '@/lib/collab-group';

const schema = z.object({ message: z.string().trim().max(1000).default('') });

export async function POST(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const input = schema.parse(await req.json().catch(() => ({})));
    const request = await withRls(user.id, async tx => {
      const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { id: true, ownerId: true, title: true } });
      if (!roadmap) throw new Error('NOT_FOUND');
      if (roadmap.ownerId === user.id) throw new Error('ALREADY_OWNER');
      const group = await findGroupForRoadmap<any>(tx, roadmapId);
      if (!group || !group.discoverable) throw new Error('GROUP_NOT_OPEN');
      const settings = (group.settings as any) || {};
      const kind = settings.kind === 'community' ? 'community' : 'team';
      if (settings.accessMode === 'invite') throw new Error('INVITE_ONLY');
      const membership = await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } } });
      if (membership) throw new Error('ALREADY_MEMBER');
      const count = await tx.collabGroupMember.count({ where: { groupId: group.id } });
      if (count >= group.maxMembers) throw new Error('GROUP_FULL');
      if (settings.accessMode === 'open' && kind === 'team') {
        const member = await tx.collabGroupMember.create({ data: { groupId: group.id, userId: user.id, role: 'editor' } });
        await tx.roadmapShare.upsert({ where: { roadmapId_userId: { roadmapId, userId: user.id } }, create: { roadmapId, userId: user.id, role: 'editor' }, update: { role: 'editor' } });
        await tx.notification.create({ data: { userId: group.ownerId, type: 'collab_group_member_joined', title: 'New member joined', body: `${user.fullName || user.email} joined ${group.name}.` } });
        return member;
      }
      const pending = await tx.collabGroupJoinRequest.findFirst({ where: { groupId: group.id, requesterId: user.id, status: 'pending' } });
      if (pending) return pending;
      const created = await tx.collabGroupJoinRequest.create({ data: { groupId: group.id, requesterId: user.id, message: input.message } });
      const memberUsers = await tx.collabGroupMember.findMany({ where: { groupId: group.id }, select: { userId: true } });
      await tx.notification.createMany({ data: memberUsers.map((m: { userId: string }) => ({ userId: m.userId, type: 'collab_group_join_request', title: `${kind === 'community' ? 'Community' : 'Team'} join request`, body: `A user requested to join ${group.name} on “${roadmap.title}”. Review and approve the request.`, collabGroupJoinRequestId: created.id })) });
      return created;
    });
    return NextResponse.json({ request }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
