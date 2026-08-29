import { AppShell } from '@/components/app-shell';
import { RoadmapTree } from '@/components/roadmap-tree';

export default async function RoadmapLiveView({ params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params;
  return <AppShell><div className="mb-4 rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] px-4 py-3 text-sm"><strong>Live view.</strong> This roadmap is read-only. Editing and collaboration are available from the editor.</div><RoadmapTree sharedRoadmapId={roadmapId} /></AppShell>;
}
