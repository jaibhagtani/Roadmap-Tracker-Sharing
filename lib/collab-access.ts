import type { Prisma } from '@prisma/client';

export type CollabRole = 'owner' | 'editor' | 'contributor' | 'topic_editor' | 'viewer' | 'none';

export async function getRoadmapRole(tx: Prisma.TransactionClient, userId: string, roadmapId: string): Promise<CollabRole> {
  const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { ownerId: true } });
  if (!roadmap) return 'none';
  if (roadmap.ownerId === userId) return 'owner';

  const group = await tx.collabGroup.findUnique({ where: { roadmapId }, select: { id: true, settings: true } });
  if (group) {
    const membership = await tx.collabGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId } }, select: { role: true } });
    const direct = (group.settings as any)?.directCollaboration !== false;
    if (membership && direct && membership.role !== 'viewer') return 'editor';
    if (membership?.role === 'viewer') return 'viewer';
  }

  const roadmapMeta = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { privacy: true } });
  const whole = await tx.roadmapShare.findUnique({
    where: { roadmapId_userId: { roadmapId, userId } },
    select: { role: true },
  });
  // A public share URL is always view-only. Collaboration on a public roadmap
  // is still possible through an explicitly approved team/community membership,
  // which is handled above via the group membership check.
  if (whole && roadmapMeta?.privacy === 'public') return 'viewer';
  if (whole?.role === 'editor') return 'editor';
  if (whole?.role === 'contributor') return 'contributor';
  if (whole) return 'viewer';

  const grants = await tx.topicShare.findMany({ where: { userId }, select: { topicId: true, role: true } });
  if (!grants.length) return 'none';
  // Public share links never grant editing, including topic-level shares.
  if (roadmapMeta?.privacy === 'public') return 'viewer';

  const topics = await tx.topic.findMany({ where: { roadmapId }, select: { id: true, parentId: true } });
  type TopicParent = { id: string; parentId: string | null };
  const byId = new Map<string, TopicParent>(topics.map((t: TopicParent) => [t.id, t]));
  let foundViewer = false;
  for (const grant of grants) {
    let current = byId.get(grant.topicId);
    let steps = 0;
    while (current && steps++ < 2000) {
      if (grant.role === 'editor' || grant.role === 'contributor') return 'topic_editor';
      foundViewer = true;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return foundViewer ? 'viewer' : 'none';
}

export async function canEditTopic(tx: Prisma.TransactionClient, userId: string, roadmapId: string, topicId: string) {
  const roadmapRole = await getRoadmapRole(tx, userId, roadmapId);
  if (roadmapRole === 'owner' || roadmapRole === 'editor') return true;
  const topic = await tx.topic.findUnique({ where: { id: topicId }, select: { id: true, roadmapId: true, parentId: true } });
  if (!topic || topic.roadmapId !== roadmapId) return false;

  const grants = await tx.topicShare.findMany({ where: { userId, role: { in: ['editor', 'contributor'] } }, select: { topicId: true } });
  const granted = new Set(grants.map((g: { topicId: string }) => g.topicId));
  let currentId: string | null = topic.id;
  let steps = 0;
  while (currentId && steps++ < 2000) {
    if (granted.has(currentId)) return true;
    const parent: { parentId: string | null } | null = await tx.topic.findUnique({ where: { id: currentId }, select: { parentId: true } });
    currentId = parent?.parentId ?? null;
  }
  return false;
}

export async function hasTopicAccess(tx: Prisma.TransactionClient, userId: string, roadmapId: string, topicId: string) {
  const role = await getRoadmapRole(tx, userId, roadmapId);
  if (role === 'owner' || role === 'editor' || role === 'viewer') return true;
  return canEditTopic(tx, userId, roadmapId, topicId);
}

export async function assertCanEditRoadmap(tx: Prisma.TransactionClient, userId: string, roadmapId: string) {
  const role = await getRoadmapRole(tx, userId, roadmapId);
  if (role !== 'owner') throw new Error('FORBIDDEN');
  return role;
}

export async function recordChange(
  tx: Prisma.TransactionClient,
  roadmapId: string,
  actorId: string,
  operation: string,
  entityType: string,
  entityId: string | null,
  payload: unknown,
) {
  const roadmap = await tx.roadmap.update({
    where: { id: roadmapId },
    data: { version: { increment: 1 } },
    select: { version: true },
  });
  const safePayload = JSON.parse(JSON.stringify(payload ?? {}));
  const event = await tx.collaborationEvent.create({
    data: { roadmapId, actorId, version: roadmap.version, operation, entityType, entityId, payload: safePayload },
  });
  return { version: roadmap.version, eventId: event.id };
}
