import { Card, Badge } from '@/components/ui';
import { RequestCollaboration } from '@/components/request-collaboration';
import { PublicRoadmapViewer } from '@/components/public-roadmap-viewer';
import { Eye, Link2 } from 'lucide-react';
import { PrivateSharedRoadmap } from '@/components/private-shared-roadmap';

export default async function Shared({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const base=process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000';
  const r=await fetch(`${base}/api/shared/${slug}`,{cache:'no-store'});
  if(r.status===401 || r.status===403)return <PrivateSharedRoadmap slug={slug} status={r.status}/>;
  if(!r.ok)return <main className="min-h-screen p-10"><Card className="mx-auto max-w-xl p-8 text-center">Roadmap not found or sharing is disabled.</Card></main>;
  const {roadmap}=await r.json();
  const isFriendsLink = roadmap.privacy === 'link';
  return <main className="min-h-screen p-6 md:p-10"><div className="mx-auto max-w-7xl">
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{isFriendsLink ? <><Link2 size={12}/> Friends / Link</> : <><Eye size={12}/> Public</>}</Badge>
          <Badge variant="outline">{isFriendsLink ? 'Collaboration allowed' : 'View only'}</Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500">{isFriendsLink ? 'People with this link can view the roadmap and request collaboration.' : 'This public roadmap is view-only. Collaboration is handled separately through approved communities.'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {isFriendsLink && <RequestCollaboration roadmapId={roadmap.id}/>}
      </div>
    </div>
    <PublicRoadmapViewer roadmap={roadmap} syncUrl={`/api/shared/${slug}?sync=1`} cloneUrl={`/api/shared/${slug}/clone`}/></div></main>;
}
