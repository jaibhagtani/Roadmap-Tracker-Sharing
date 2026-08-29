import { redirect } from 'next/navigation';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { CollaborationWorkspace } from '@/components/collaboration-workspace';

export default async function CollaborationPage({params,searchParams}:{params:Promise<{roadmapId:string}>;searchParams?:Promise<{create?:string}>}) {
  const {roadmapId}=await params;
  const query=searchParams?await searchParams:{};
  const createKind=query.create==='team'?'team':query.create==='community'?'community':undefined;
  const user = await requireUser();

  // Direct-collaboration teams get their dedicated Team Activity workspace.
  // Community/branch collaboration stays on the normal collaboration page.
  const group = await withRls(user.id, tx => tx.collabGroup.findUnique({
    where: { roadmapId },
    select: { id: true, settings: true, members: { where: { userId: user.id }, select: { id: true, role: true } } },
  }));
  const settings = (group?.settings && typeof group.settings === 'object') ? (group.settings as Record<string, unknown>) : {};
  const isTeam = settings.kind === 'team';
  const isCommunity = settings.kind === 'community';
  const directCollab = settings.directCollaboration === true;
  const isMember = !!group?.members?.length;
  const canOpenTeam = isTeam && directCollab && isMember;
  if (canOpenTeam && group?.id) redirect(`/team-activity/${group.id}`);
  if (isCommunity && isMember && group?.id) redirect(`/community-activity/${group.id}`);

  return <CollaborationWorkspace roadmapId={roadmapId} createKind={createKind}/>;
}
