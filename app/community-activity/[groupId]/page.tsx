import { notFound, redirect } from 'next/navigation';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { TeamActivityWorkspace } from '@/components/team-activity-workspace';

export default async function CommunityActivityPage({params}:{params:Promise<{groupId:string}>}) {
  const {groupId}=await params;
  const user = await requireUser();
  const group = await withRls(user.id, tx => tx.collabGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      roadmapId: true,
      name: true,
      description: true,
      maxMembers: true,
      settings: true,
      roadmap: { select: { privacy: true } },
      members: { where: { userId: user.id }, select: { id: true, role: true } },
    },
  }));
  if (!group) notFound();
  const settings = group.settings && typeof group.settings === 'object' ? group.settings as Record<string, unknown> : {};
  const isCommunity = settings.kind === 'community';
  const membership = group.members[0];
  if (!isCommunity) redirect(`/team-activity/${group.id}`);
  if (group.roadmap.privacy !== 'public') redirect(`/collaborate/${group.roadmapId}`);
  if (!membership) redirect(`/collaborate/${group.roadmapId}#community`);
  return (
    <TeamActivityWorkspace
      groupId={group.id}
      roadmapId={group.roadmapId}
      groupName={group.name}
      groupDescription={group.description}
      memberRole={membership.role}
      isOwner={group.members[0]?.role === 'owner'}
      maxMembers={group.maxMembers}
      kind="community"
    />
  );
}
