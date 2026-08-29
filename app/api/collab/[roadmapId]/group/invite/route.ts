import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { findGroupForRoadmap } from '@/lib/collab-group';

const schema = z.object({
  userIds: z.array(z.string().min(1).max(255)).min(1).max(50),
  role: z.enum(['viewer','contributor','editor']).default('contributor'),
});

export async function POST(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const input = schema.parse(await req.json());
    const result = await withRls(user.id, async tx => {
      const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { id: true, ownerId: true, title: true } });
      if (!roadmap) throw new Error('NOT_FOUND');
      const group = await findGroupForRoadmap<any>(tx, roadmapId);
      if (!group) throw new Error('GROUP_NOT_FOUND');
      const inviterMembership = await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } }, select: { id: true, role: true } });
      const groupSettings = (group.settings as any) || {};
      const isCommunity = groupSettings.kind === 'community';
      if (isCommunity ? roadmap.ownerId !== user.id : (roadmap.ownerId !== user.id && !inviterMembership)) throw new Error('FORBIDDEN');
      await tx.$queryRaw`select id from collab_groups where id=${group.id}::uuid for update`;
      const existing = await tx.collabGroupMember.findMany({ where: { groupId: group.id, userId: { in: input.userIds } }, select: { userId: true } });
      const existingSet = new Set(existing.map((x: { userId: string })=>x.userId));
      const ids = [...new Set(input.userIds)].filter(id => id !== user.id && !existingSet.has(id));
      const count = await tx.collabGroupMember.count({ where: { groupId: group.id } });
      const available = Math.max(0, group.maxMembers - count);
      if (ids.length > available) throw new Error('GROUP_FULL');
      const groupRoadmapIds = Array.from(new Set([group.roadmapId, ...(Array.isArray(groupSettings.roadmapIds) ? groupSettings.roadmapIds : []), roadmapId]));
      for (const id of ids) {
        await tx.collabGroupMember.create({ data: { groupId: group.id, userId: id, role: input.role } });
        for (const rid of groupRoadmapIds) {
          await tx.roadmapShare.upsert({ where: { roadmapId_userId: { roadmapId: rid, userId: id } }, create: { roadmapId: rid, userId: id, role: input.role }, update: { role: input.role } });
        }
        await tx.notification.create({ data: { userId: id, type: 'collab_group_invite', title: `Added to ${group.name}`, body: `You now have ${input.role} access to the group roadmaps.` } });
      }
      return { added: ids.length, userIds: ids, role: input.role };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
