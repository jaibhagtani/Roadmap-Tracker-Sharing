import { notFound, redirect } from 'next/navigation';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { RoadmapEditor } from '@/components/roadmap-editor';

export default async function CommunityRoadmapEditorPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const user = await requireUser();
  const group = await withRls(user.id, tx => tx.collabGroup.findUnique({
    where: { id: groupId },
    select: { id: true, roadmapId: true, settings: true, members: { where: { userId: user.id }, select: { role: true } } },
  }));
  if (!group) notFound();
  const settings = group.settings && typeof group.settings === 'object' ? group.settings as Record<string, unknown> : {};
  if (settings.kind !== 'community') redirect(`/roadmap/${group.roadmapId}`);
  if (!group.members.length) redirect(`/community-activity/${group.id}`);
  // Community-specific editor: opens this community's existing roadmap directly.
  // No clone is created; RoadmapEditor/API permissions control edit access.
  return <RoadmapEditor initialRoadmapId={group.roadmapId} />;
}
