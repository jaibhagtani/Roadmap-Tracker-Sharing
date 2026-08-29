import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { findGroupForRoadmap } from '@/lib/collab-group';

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(''),
  maxMembers: z.number().int().min(2).max(100).default(10),
  discoverable: z.boolean().default(true),
  settings: z.object({ kind: z.enum(['team','community']).default('team'), cohort: z.string().trim().max(80).default(''), accessMode: z.enum(['invite','request','open']).optional(), directCollaboration: z.boolean().optional() }).default({ kind: 'team', cohort: '' }),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  maxMembers: z.number().int().min(2).max(100).optional(),
  discoverable: z.boolean().optional(),
  settings: z.object({ kind: z.enum(['team','community']).optional(), cohort: z.string().trim().max(80).optional(), accessMode: z.enum(['invite','request','open']).optional(), directCollaboration: z.boolean().optional() }).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const result = await withRls(user.id, async tx => {
      const roadmap = await tx.roadmap.findUnique({
        where: { id: roadmapId },
        select: { id: true, ownerId: true, title: true, privacy: true },
      });
      if (!roadmap) throw new Error('NOT_FOUND');

      const group = await findGroupForRoadmap<any>(tx, roadmapId);
      if (!group) {
        return { group: null, isOwner: roadmap.ownerId === user.id, membership: null, members: [], pendingRequests: [] };
      }

      const visible = roadmap.ownerId === user.id || group.discoverable || await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } }, select: { id: true } });
      if (!visible) throw new Error('FORBIDDEN');

      const membership = await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } } });
      const groupSettings = (group.settings as any) || {};
      const kind = groupSettings.kind === 'community' ? 'community' : 'team';
      const [members, pendingRequests] = await Promise.all([
        tx.collabGroupMember.findMany({ where: { groupId: group.id }, orderBy: { createdAt: 'asc' } }),
        (roadmap.ownerId === user.id || !!membership)
          ? tx.collabGroupJoinRequest.findMany({ where: { groupId: group.id, status: 'pending' }, orderBy: { createdAt: 'asc' }, take: 100 })
          : Promise.resolve([]),
      ]);

      return {
        group,
        groupSettings: (group.settings as any) || {},
        isOwner: roadmap.ownerId === user.id,
        membership,
        memberCount: members.length,
        members,
        pendingRequests,
        roadmapTitle: roadmap.title,
        privacy: kind === 'community' ? 'public' : roadmap.privacy,
        inviteLink: `/collaborate/join/${group.inviteToken}`,
        directCollaboration: kind === 'community' || (group.settings as any)?.directCollaboration !== false,
      };
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const input = createSchema.parse(await req.json());
    const group = await withRls(user.id, async tx => {
      const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { id: true, ownerId: true, title: true } });
      if (!roadmap) throw new Error('NOT_FOUND');
      if (roadmap.ownerId !== user.id) throw new Error('FORBIDDEN');
      const existing = await findGroupForRoadmap<any>(tx, roadmapId);
      if (existing) throw new Error('GROUP_EXISTS');
      const kind = input.settings.kind || 'team';
      const accessMode = input.settings.accessMode || (kind === 'community' ? 'request' : 'invite');
      const directCollaboration = true;
      if (kind === 'community') {
        await tx.roadmap.update({ where: { id: roadmapId }, data: { privacy: 'public' } });
      }
      return tx.collabGroup.create({
        data: {
          roadmapId,
          ownerId: user.id,
          name: input.name,
          description: input.description,
          maxMembers: input.maxMembers,
          discoverable: kind === 'community' ? true : input.discoverable,
          settings: { kind, cohort: input.settings.cohort || '', accessMode, directCollaboration },
          members: { create: { userId: user.id, role: 'owner' } },
        },
        include: { members: true },
      });
    });
    return NextResponse.json({ group }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'GROUP_EXISTS') return new Response(msg, { status: 409 });
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const input = updateSchema.parse(await req.json());
    const group = await withRls(user.id, async tx => {
      const group = await findGroupForRoadmap<any>(tx, roadmapId);
      if (!group) throw new Error('NOT_FOUND');
      if (group.ownerId !== user.id) throw new Error('FORBIDDEN');
      if (input.maxMembers !== undefined) {
        const count = await tx.collabGroupMember.count({ where: { groupId: group.id } });
        if (input.maxMembers < count) throw new Error('MAX_BELOW_CURRENT');
      }
      const currentSettings = (group.settings as any) || {};
      const kind = currentSettings.kind === 'community' ? 'community' : 'team';
      const requestedSettings = input.settings || {};
      const nextSettings = kind === 'community'
        ? { ...currentSettings, ...requestedSettings, kind: 'community', accessMode: 'request', directCollaboration: true }
        : { ...currentSettings, ...requestedSettings, kind: 'team', directCollaboration: true };
      const nextData: any = { ...input, settings: nextSettings };
      if (kind === 'community') nextData.discoverable = true;
      const updated = await tx.collabGroup.update({ where: { id: group.id }, data: nextData });
      if (kind === 'community') await tx.roadmap.update({ where: { id: roadmapId }, data: { privacy: 'public' } });
      return updated;
    });
    return NextResponse.json({ group });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'MAX_BELOW_CURRENT') return new Response(msg, { status: 409 });
    return errorResponse(e);
  }
}
