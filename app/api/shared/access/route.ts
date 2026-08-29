import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/db';
import { getRoadmapRole } from '@/lib/collab-access';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const id = new URL(req.url).searchParams.get('roadmapId');
    if (!id) return new Response('roadmapId required', { status: 400 });

    const data = await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, id);
      if (role === 'none') return null;
      const roadmap = await tx.roadmap.findUnique({
        where: { id },
        include: { topics: { include: { resources: true }, orderBy: [{ parentId: 'asc' }, { position: 'asc' }] } },
      });
      if (!roadmap) return null;

      const grants = await tx.topicShare.findMany({ where: { userId: user.id, topic: { roadmapId: id } }, select: { topicId: true, role: true } });
      const personalProgress = await tx.userTopicProgress.findMany({ where: { userId: user.id, topic: { roadmapId: id } }, select: { topicId: true, status: true, updatedAt: true } });
      const whole = await tx.roadmapShare.findUnique({ where: { roadmapId_userId: { roadmapId: id, userId: user.id } }, select: { role: true } });
      const group = await tx.collabGroup.findUnique({ where: { roadmapId: id }, select: { id: true, settings: true } });
      const groupMembership = group ? await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } }, select: { role: true } }) : null;
      const groupSettings = (group?.settings as any) || {};
      const groupKind = groupSettings.kind === 'community' ? 'community' : 'team';
      const directGroup = !!groupMembership && groupMembership.role !== 'viewer' && (groupKind === 'community' || groupSettings.directCollaboration !== false);
      const isOwner = roadmap.ownerId === user.id;
      const allowedRootIds = grants.map((g: { topicId: string }) => g.topicId);

      if (isOwner || whole || groupMembership) {
        return { roadmap, access: isOwner ? 'owner' : 'roadmap', role, allowedRootIds: [] as string[], personalProgress, directGroup };
      }

      const visible = new Set<string>();
      const stack = [...allowedRootIds];
      while (stack.length) {
        const root = stack.pop()!;
        if (visible.has(root)) continue;
        visible.add(root);
        for (const topic of roadmap.topics) if (topic.parentId === root) stack.push(topic.id);
      }
      return { roadmap: { ...roadmap, topics: roadmap.topics.filter((t: { id: string }) => visible.has(t.id)) }, access: 'topic', role, allowedRootIds, personalProgress: personalProgress.filter((p: { topicId: string }) => visible.has(p.topicId)) };
    });

    if (!data) return new Response('Not found', { status: 404 });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
