import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { findGroupForRoadmap } from '@/lib/collab-group';

const patchSchema = z.object({ requestId: z.string().uuid(), action: z.enum(['accept','reject']) });

export async function GET(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const data = await withRls(user.id, async tx => {
      const group = await tx.collabGroup.findUnique({ where: { roadmapId }, select: { id: true, ownerId: true, settings: true } });
      if (!group) throw new Error('NOT_FOUND');
      const membership = await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } }, select: { id: true } });
      const settings = (group.settings as any) || {};
      const kind = settings.kind === 'community' ? 'community' : 'team';
      const canApprove = kind === 'community' ? group.ownerId === user.id : (group.ownerId === user.id || !!membership);
      if (!canApprove) throw new Error('FORBIDDEN');
      return tx.collabGroupJoinRequest.findMany({ where: { groupId: group.id, status: 'pending' }, orderBy: { createdAt: 'asc' }, take: 100 });
    });
    return NextResponse.json({ requests: data });
  } catch (e) { return errorResponse(e); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const input = patchSchema.parse(await req.json());
    const result = await withRls(user.id, async tx => {
      const group = await tx.collabGroup.findUnique({ where: { roadmapId }, select: { id: true, ownerId: true, maxMembers: true, name: true, settings: true } });
      if (!group) throw new Error('NOT_FOUND');
      const membership = await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } }, select: { id: true } });
      const settings = (group.settings as any) || {};
      const kind = settings.kind === 'community' ? 'community' : 'team';
      const canApprove = kind === 'community' ? group.ownerId === user.id : (group.ownerId === user.id || !!membership);
      if (!canApprove) throw new Error('FORBIDDEN');

      const request = await tx.collabGroupJoinRequest.findUnique({ where: { id: input.requestId } });
      if (!request || request.groupId !== group.id || request.status !== 'pending') throw new Error('REQUEST_NOT_FOUND');

      if (input.action === 'accept') {
        const existing = await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: request.requesterId } } });
        if (!existing) {
          // Lock the group row so concurrent accept actions cannot exceed the owner's member limit.
          await tx.$queryRaw`select id from collab_groups where id=${group.id}::uuid for update`;
          const count = await tx.collabGroupMember.count({ where: { groupId: group.id } });
          if (count >= group.maxMembers) throw new Error('GROUP_FULL');
          await tx.collabGroupMember.create({ data: { groupId: group.id, userId: request.requesterId, role: 'editor' } });
          const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { title: true } });
          const groupSettings = (group.settings as any) || {};
          const groupRoadmapIds = Array.from(new Set([roadmapId, ...(groupSettings.roadmapIds || [])]));
          for (const rid of groupRoadmapIds) {
            await tx.roadmapShare.upsert({ where: { roadmapId_userId: { roadmapId: rid, userId: request.requesterId } }, create: { roadmapId: rid, userId: request.requesterId, role: 'contributor' }, update: { role: 'contributor' } });
          }
          await tx.notification.create({ data: { userId: request.requesterId, type: 'collab_group_join_result', title: `Joined ${group.name}`, body: `Your request to join ${kind} ${group.name} for “${roadmap?.title ?? 'roadmap'}” was accepted. ${kind === 'team' ? 'You can now edit the shared roadmap directly.' : 'The community owner has granted collaborative access.'}` , collabGroupJoinRequestId: request.id } });
          await tx.notification.createMany({ data: (await tx.collabGroupMember.findMany({ where: { groupId: group.id, userId: { not: request.requesterId } }, select: { userId: true } })).map((m: { userId: string }) => ({ userId: m.userId, type: 'collab_group_member_joined', title: `New ${kind} member`, body: `${request.requesterId} joined ${group.name}.`, collabGroupJoinRequestId: request.id })) });
        }
      } else {
        await tx.notification.create({ data: { userId: request.requesterId, type: 'collab_group_join_result', title: `Join request rejected`, body: `Your request to join ${group.name} was rejected.`, collabGroupJoinRequestId: request.id } });
      }

      return tx.collabGroupJoinRequest.update({ where: { id: request.id }, data: { status: input.action === 'accept' ? 'accepted' : 'rejected', reviewedBy: user.id, reviewedAt: new Date() } });
    });
    return NextResponse.json({ request: result });
  } catch (e) { return errorResponse(e); }
}
