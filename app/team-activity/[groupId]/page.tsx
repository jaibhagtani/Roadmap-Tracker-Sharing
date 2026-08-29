import { notFound, redirect } from 'next/navigation';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { TeamActivityWorkspace } from '@/components/team-activity-workspace';

export default async function TeamActivityPage({params}:{params:Promise<{groupId:string}>}) {
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
      members: { where: { userId: user.id }, select: { id: true, role: true } },
    },
  }));
  if (!group) notFound();
  const settings = group.settings && typeof group.settings === 'object' ? group.settings as Record<string, unknown> : {};
  const isTeam = settings.kind === 'team' && settings.directCollaboration === true;
  const membership = group.members[0];
  if (!isTeam || !membership) redirect(`/collaborate/${group.roadmapId}`);
  return (
    <TeamActivityWorkspace
      groupId={group.id}
      roadmapId={group.roadmapId}
      groupName={group.name}
      groupDescription={group.description}
      memberRole={membership.role}
      maxMembers={group.maxMembers}
    />
  );
}
