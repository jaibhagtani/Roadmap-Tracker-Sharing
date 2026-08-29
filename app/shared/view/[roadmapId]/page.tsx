'use client';
import { use } from 'react';
import { AppShell } from '@/components/app-shell';
import { RoadmapTree } from '@/components/roadmap-tree';

export default function SharedView({ params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = use(params);
  return (
    <AppShell>
      <div className="mb-4 rounded-xl border border-[hsl(var(--line))] bg-slate-50/60 px-4 py-3 text-sm dark:bg-slate-900/50">
        <strong>Live collaborative view.</strong> Changes made by an editor are synchronized to other collaborators automatically. Viewer access is read-only.
      </div>
      <RoadmapTree sharedRoadmapId={roadmapId} />
    </AppShell>
  );
}
