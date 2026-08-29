import { Card } from '@/components/ui';
import { PublicRoadmapViewer } from '@/components/public-roadmap-viewer';

export default async function SharedTopic({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${base}/api/shared/topic/${token}`, { cache: 'no-store' });
  if (!res.ok) return <main className="min-h-screen p-10"><Card className="mx-auto max-w-xl p-8 text-center">Shared layer not found or the link was revoked.</Card></main>;
  const { share } = await res.json();
  const roadmap = { id: share.roadmap.id, title: `${share.roadmap.title} · ${share.rootTitle}`, description: share.roadmap.description, shareSlug: share.roadmap.shareSlug, privacy: share.roadmap.privacy, editorState: share.roadmap.editorState, topics: share.topics };
  return <main className="min-h-screen p-6 md:p-10"><div className="mx-auto max-w-7xl"><div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-100">This shared link contains only <b>{share.rootTitle}</b> and its children. Sibling and parent topics are not exposed.</div><PublicRoadmapViewer roadmap={roadmap} syncUrl={`/api/shared/topic/${token}?sync=1`} showLiveView={false}/></div></main>;
}
