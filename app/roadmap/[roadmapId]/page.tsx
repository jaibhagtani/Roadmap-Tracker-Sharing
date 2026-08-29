import { AppShell } from '@/components/app-shell';
import { RoadmapEditor } from '@/components/roadmap-editor';

export default async function RoadmapById({ params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params;
  return <AppShell><RoadmapEditor initialRoadmapId={roadmapId} /></AppShell>;
}
