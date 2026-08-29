import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { findGroupForRoadmap } from '@/lib/collab-group';

const schema = z.object({ userId: z.string().trim().min(1).max(255).optional() });
const roleSchema = z.object({ userId: z.string().trim().min(1).max(255), role: z.enum(['viewer','contributor','editor']) });

export async function GET(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const data = await withRls(user.id, async tx => {
      const group = await findGroupForRoadmap<any>(tx, roadmapId);
      if (!group) throw new Error('NOT_FOUND');
      const member = await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } } });
      if (group.ownerId !== user.id && !member) throw new Error('FORBIDDEN');
      return tx.collabGroupMember.findMany({ where: { groupId: group.id }, orderBy: { createdAt: 'asc' } });
    });
    return NextResponse.json({ members: data });
  } catch (e) { return errorResponse(e); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const input = roleSchema.parse(await req.json());
    const member = await withRls(user.id, async tx => {
      const group = await findGroupForRoadmap<any>(tx, roadmapId);
      if (!group || group.ownerId !== user.id) throw new Error('FORBIDDEN');
      if (input.userId === group.ownerId) throw new Error('OWNER_ROLE_LOCKED');
      const updated = await tx.collabGroupMember.updateMany({ where: { groupId: group.id, userId: input.userId }, data: { role: input.role } });
      if (!updated.count) throw new Error('NOT_FOUND');
      await tx.roadmapShare.updateMany({ where: { roadmapId, userId: input.userId }, data: { role: input.role } });
      await tx.notification.create({ data: { userId: input.userId, type: 'collab_group_role_changed', title: `Access updated in ${group.name}`, body: `Your shared roadmap access is now ${input.role}.` } });
      return tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: input.userId } } });
    });
    return NextResponse.json({ member });
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const input = schema.parse(await req.json().catch(() => ({})));
    const target = input.userId ?? user.id;
    await withRls(user.id, async tx => {
      const group = await findGroupForRoadmap<any>(tx, roadmapId);
      if (!group) throw new Error('NOT_FOUND');
      const actorMembership = await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } } });
      if (group.ownerId !== user.id && (!actorMembership || target !== user.id)) throw new Error('FORBIDDEN');
      if (target === group.ownerId) throw new Error('OWNER_CANNOT_LEAVE');
      await tx.collabGroupMember.deleteMany({ where: { groupId: group.id, userId: target } });
      await tx.roadmapShare.deleteMany({ where: { roadmapId, userId: target } });
      await tx.notification.create({ data: { userId: target, type: 'collab_group_member_removed', title: 'Removed from community', body: `You are no longer a member of ${group.name}.` } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
