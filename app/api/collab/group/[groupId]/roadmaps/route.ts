import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';

const schema = z.object({ roadmapId: z.string().uuid() });

function roadmapIds(settings: unknown, fallback?: string): string[] {
  const value = (settings as any) || {};
  const ids = Array.isArray(value.roadmapIds) ? value.roadmapIds.filter((x: unknown): x is string => typeof x === 'string') : [];
  return Array.from(new Set(fallback ? [fallback, ...ids] : ids));
}

export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const user = await requireUser();
    const { groupId } = await params;
    const data = await withRls(user.id, async tx => {
      const group = await tx.collabGroup.findUnique({ where: { id: groupId }, select: { id: true, name: true, ownerId: true, roadmapId: true, settings: true, members: { select: { userId: true } } } });
      if (!group) throw new Error('NOT_FOUND');
      const isMember = group.ownerId === user.id || group.members.some((m: { userId: string }) => m.userId === user.id);
      const settings = (group.settings as any) || {};
      const discoverable = settings.kind === 'community' ? true : Boolean(settings.discoverable ?? false);
      if (!isMember && !discoverable) throw new Error('FORBIDDEN');
      const ids: string[] = roadmapIds(group.settings, group.roadmapId);
      const roadmaps = await tx.roadmap.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, description: true, privacy: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } });
      return { group: { id: group.id, name: group.name,  ownerId: group.ownerId, roadmapId: group.roadmapId, settings: group.settings }, roadmaps };
    });
    return NextResponse.json(data);
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const user = await requireUser();
    const { groupId } = await params;
    const input = schema.parse(await req.json());
    const result = await withRls(user.id, async tx => {
      const group = await tx.collabGroup.findUnique({ where: { id: groupId }, select: { id: true, ownerId: true, roadmapId: true, settings: true } });
      if (!group) throw new Error('NOT_FOUND');
      if (group.ownerId !== user.id) throw new Error('FORBIDDEN');
      const roadmap = await tx.roadmap.findUnique({ where: { id: input.roadmapId }, select: { id: true, ownerId: true } });
      if (!roadmap || roadmap.ownerId !== user.id) throw new Error('ROADMAP_NOT_OWNED');
      const currentIds = roadmapIds(group.settings, group.roadmapId);
      if (currentIds.includes(input.roadmapId)) return { roadmapId: input.roadmapId, added: false };
      const settings = { ...((group.settings as any) || {}), roadmapIds: [...currentIds, input.roadmapId] };
      await tx.collabGroup.update({ where: { id: group.id }, data: { settings } });
      const members = await tx.collabGroupMember.findMany({ where: { groupId: group.id }, select: { userId: true, role: true } });
      for (const member of members) {
        await tx.roadmapShare.upsert({ where: { roadmapId_userId: { roadmapId: input.roadmapId, userId: member.userId } }, create: { roadmapId: input.roadmapId, userId: member.userId, role: member.role === 'owner' ? 'owner' : member.role }, update: { role: member.role === 'owner' ? 'owner' : member.role } });
      }
      return { roadmapId: input.roadmapId, added: true };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
