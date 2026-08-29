'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Lock, X } from 'lucide-react';
import { Badge, Button, Card } from './ui';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import { RoadmapVisualCanvas } from './studio-canvas';
import { SyncRoadmapButton } from './sync-roadmap-button';

type Resource = { id:string; title:string; url:string; type:string; notes:string; completed:boolean; favorite:boolean };
type Topic = { id:string; roadmapId:string; parentId:string|null; title:string; description:string; notes:string; status:'not_started'|'in_progress'|'completed'; progress:number; priority:number; position:number; tags:string[]; dueDate:string|null; resources:Resource[] };
type Roadmap = { id:string; title:string; description:string; shareSlug:string; privacy:'private'|'link'|'public'; topics:Topic[]; editorState?: any };

type Props = { roadmap: Roadmap; syncUrl?: string; cloneUrl?: string; showLiveView?: boolean };
type PersonalStatus = 'learning'|'done'|'skipped';

export function PublicRoadmapViewer({ roadmap: initialRoadmap, syncUrl, cloneUrl, showLiveView = true }: Props) {
  const [roadmap, setRoadmap] = useState<Roadmap>(initialRoadmap);
  const [selectedId, setSelectedId] = useState<string|null>(roadmap.topics[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [progressSaving, setProgressSaving] = useState(false);
  const progressQuery = useGetJsonQuery(
    { url:selectedId ? `/api/topics/${selectedId}/progress` : '/api/topics/__empty__/progress', tag:selectedId ? `topic-progress:${selectedId}` : 'topic-progress-empty' },
    { skip:!selectedId }
  );
  const [request] = useRequestMutation();
  const currentProgress = ((progressQuery.data as any)?.progress?.status || 'learning') as PersonalStatus;
  const selected = useMemo(() => roadmap.topics.find(t=>t.id===selectedId) ?? null,[roadmap.topics,selectedId]);

  useEffect(() => {
    setSelectedId(current => current && roadmap.topics.some(t => t.id === current) ? current : roadmap.topics[0]?.id ?? null);
  }, [roadmap]);

  const [cloning, setCloning] = useState(false);

  async function cloneIntoAccount() {
    if (!cloneUrl || cloning) return;
    setCloning(true);
    try {
      const r = await fetch(cloneUrl, { method: 'POST' });
      if (r.status === 401) {
        location.href = `/auth/login?next=${encodeURIComponent(location.pathname)}`;
        return;
      }
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      if (!j.roadmap?.id) throw new Error('The cloned roadmap was not returned.');
      location.href = `/roadmap?roadmapId=${encodeURIComponent(j.roadmap.id)}`;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not clone this roadmap.');
    } finally {
      setCloning(false);
    }
  }

  async function syncLatest() {
    if (!syncUrl) return;
    const r = await fetch(syncUrl, { cache: 'no-store' });
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    const next = j.roadmap || j.share?.roadmap;
    if (!next) throw new Error('Latest roadmap was not returned.');
    if (j.share) {
      setRoadmap(prev => ({ ...prev, title: `${next.title} · ${j.share.rootTitle}`, description: next.description, topics: j.share.topics }));
    } else {
      setRoadmap(next);
    }
  }

  async function mark(status:PersonalStatus) {
    if (!selected || progressSaving) return;
    setProgressSaving(true);
    try {
      const result=await request({
        url:`/api/topics/${selected.id}/progress`,
        method:'PATCH',
        body:{status},
        invalidate:[`topic-progress:${selected.id}`],
      });
      if((result as any).error){
        const statusCode=(result as any).error?.status;
        if(statusCode===401){location.href=`/auth/login?next=${encodeURIComponent(location.pathname)}`;return;}
        throw new Error((result as any).error?.data?.error || 'Could not update your progress');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not update your progress');
    } finally { setProgressSaving(false); }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="flex items-center gap-2"><Badge>Read-only roadmap</Badge><span className="text-xs text-slate-500">Your Done/Skip state is personal and does not edit the roadmap.</span></div><h1 className="mt-2 text-3xl font-bold">{roadmap.title}</h1><p className="mt-1 text-sm text-slate-500">{roadmap.description}</p></div>
      <div className="flex flex-wrap items-center gap-2">{cloneUrl && <Button variant="outline" onClick={() => void cloneIntoAccount()} disabled={cloning}><Copy size={14}/> {cloning ? 'Cloning…' : 'Clone to my account'}</Button>}<SyncRoadmapButton onSync={syncLatest} compact />{showLiveView && roadmap.id && <a href={`/roadmap/${roadmap.id}/live`} className="text-sm text-indigo-600 underline">Live view</a>}</div>
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
      <Card className="min-h-[720px] overflow-hidden p-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search topics, tags, descriptions…" className="min-w-0 flex-1 rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-sm"/>
          {search && <button onClick={()=>setSearch('')} className="rounded-lg border px-2 py-2 text-xs">Clear</button>}
          
        </div>
        <div className="roadmap-canvas-shell roadmap-canonical-surface studio-public-canvas"><RoadmapVisualCanvas roadmapId={roadmap.id} topics={roadmap.topics} editorState={roadmap.editorState} search={search} selectedId={selectedId} locked showLockBadge={false} onSelect={setSelectedId} /></div>
      </Card>
      <Card className="p-5">
        {!selected ? <div className="grid min-h-[420px] place-items-center text-center text-sm text-slate-500"><Lock size={28}/><p>Select a topic to see details.</p></div> : <>
          <div className="flex items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-wider text-slate-400">Topic</div><h2 className="mt-1 text-xl font-semibold">{selected.title}</h2></div><Badge>{currentProgress==='done'?'Done':currentProgress==='skipped'?'Skipped':'Learning'}</Badge></div>
          <div className="mt-4 grid grid-cols-3 gap-2"><button disabled={progressSaving} onClick={()=>void mark('learning')} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${!progressQuery.data||currentProgress==='learning'?'border-indigo-500 bg-indigo-50 text-indigo-700':'border-[hsl(var(--line))]'}`}>Learning</button><button disabled={progressSaving} onClick={()=>void mark('done')} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${currentProgress==='done'?'border-emerald-500 bg-emerald-50 text-emerald-700':'border-[hsl(var(--line))]'}`}><Check size={13} className="mr-1 inline"/>Done</button><button disabled={progressSaving} onClick={()=>void mark('skipped')} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${currentProgress==='skipped'?'border-amber-500 bg-amber-50 text-amber-700':'border-[hsl(var(--line))]'}`}><X size={13} className="mr-1 inline"/>Skip</button></div>
          <div className="mt-4 space-y-3 text-sm"><div><span className="font-semibold">Description:</span> {selected.description||'No description.'}</div><div><span className="font-semibold">Notes:</span> {selected.notes||'No notes.'}</div><div><span className="font-semibold">Progress:</span> {selected.progress}%</div><div><span className="font-semibold">Tags:</span> {selected.tags.length?selected.tags.join(', '):'No tags'}</div><div><span className="font-semibold">Due:</span> {selected.dueDate?new Date(selected.dueDate).toLocaleDateString():'No due date'}</div></div>
          <div className="mt-5 border-t border-[hsl(var(--line))] pt-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Resources</h3><span className="text-xs text-slate-500">{selected.resources.length}</span></div><div className="mt-3 space-y-2">{selected.resources.length?selected.resources.map(r=><a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-[hsl(var(--line))] p-3 hover:border-indigo-300"><div className="font-medium">{r.title}</div><div className="mt-1 text-xs text-slate-500">{r.type}{r.completed?' · completed':''}{r.favorite?' · favorite':''}</div>{r.notes&&<div className="mt-1 text-xs text-slate-500">{r.notes}</div>}</a>):<p className="text-sm text-slate-500">No resources added.</p>}</div></div>
        </>}
      </Card>
    </div>
  </div>;
}
