'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGetJsonQuery, useLazyGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card } from '@/components/ui';
import { ArrowLeft, ArrowRight, CheckCircle2, Globe2, Plus, Search, ShieldCheck, UserPlus, Users, X } from 'lucide-react';

type Roadmap = { id: string; title: string; description?: string; privacy?: string; _count?: { topics: number } };
type User = { id: string; email: string; fullName: string };
type Kind = 'community' | 'team';

type Draft = {
  name: string;
  description: string;
  cohort: string;
  maxMembers: number;
  inviteRole: 'viewer'|'contributor'|'editor';
  invitees: User[];
};

function CreateCollaborationContent() {
  const router = useRouter();
  const params = useSearchParams();
  const rawKind = params.get('type');
  const kind: Kind = rawKind === 'community' ? 'community' : 'team';
  const fromGroupId = params.get('fromGroup');
  const [step, setStep] = useState(1);
  const [roadmapChoice, setRoadmapChoice] = useState<'new'|'existing'>('new');
  const [selectedRoadmapId, setSelectedRoadmapId] = useState('');
  const [newRoadmapName, setNewRoadmapName] = useState(kind === 'team' ? 'Team Roadmap' : 'Community Roadmap');
  const [query, setQuery] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [draft, setDraft] = useState<Draft>({ name: '', description: '', cohort: '', maxMembers: 10, inviteRole: 'contributor', invitees: [] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const roadmapsQuery = useGetJsonQuery({ url:'/api/roadmaps', tag:'roadmaps' });
  const groupRoadmapsQuery = useGetJsonQuery(
    { url:`/api/collab/group/${fromGroupId}/roadmaps`, tag:`group-roadmaps:${fromGroupId}` },
    { skip:!fromGroupId }
  );
  const [searchUsers, searchUsersState] = useLazyGetJsonQuery();
  const [request] = useRequestMutation();

  const roadmaps = (((roadmapsQuery.data as any)?.roadmaps || []) as Roadmap[]);
  const groupRoadmaps = (((groupRoadmapsQuery.data as any)?.roadmaps || []) as Roadmap[]);
  const loading = roadmapsQuery.isLoading;
  const groupLoading = !!fromGroupId && groupRoadmapsQuery.isLoading;
  const memberResults = (((searchUsersState.data as any)?.users || []) as User[]);

  useEffect(() => {
    if (!fromGroupId) return;
    const data:any = groupRoadmapsQuery.data;
    const primary = groupRoadmaps.find((r:Roadmap) => r.id === data?.group?.roadmapId) || groupRoadmaps[0];
    if (!primary) return;
    setSelectedRoadmapId(primary.id);
    if (data?.group?.name) setDraft(v => v.name ? v : ({ ...v, name:data.group.name }));
    setStep(2);
  }, [fromGroupId, groupRoadmapsQuery.data, groupRoadmaps]);

  useEffect(() => {
    if (kind !== 'team') return;
    const q=memberSearch.trim();
    if (q.length < 2) return;
    const timer=window.setTimeout(() => {
      void searchUsers({url:`/api/users/search?q=${encodeURIComponent(q)}`,tag:`users:${q.toLowerCase()}`});
    },300);
    return () => window.clearTimeout(timer);
  }, [memberSearch, kind, searchUsers]);

  const availableRoadmaps = roadmaps;
  const filteredRoadmaps = useMemo(() => availableRoadmaps.filter(r => `${r.title} ${r.description || ''}`.toLowerCase().includes(query.toLowerCase().trim())), [roadmaps, query]);
  const noun = kind === 'team' ? 'team' : 'community';
  const accent = kind === 'team' ? 'indigo' : 'emerald';

  const toggleInvitee = (user: User) => setDraft(v => ({ ...v, invitees: v.invitees.some(x => x.id === user.id) ? v.invitees.filter(x => x.id !== user.id) : [...v.invitees, user] }));

  async function submit() {
    setSubmitting(true); setError('');
    try {
      let roadmapId=selectedRoadmapId;
      let createdGroupId:string|undefined;
      if (roadmapChoice === 'new') {
        const result=await request({
          url:'/api/roadmaps', method:'POST',
          body:{title:newRoadmapName.trim()||`${kind==='team'?'Team':'Community'} Roadmap`,description:'',privacy:kind==='community'?'public':'private'},
          invalidate:['roadmaps','dashboard'],
        });
        if((result as any).error) throw new Error(apiError((result as any).error));
        roadmapId=(result as any).data?.roadmap?.id||'';
      }
      if(!roadmapId) throw new Error('Choose a roadmap first.');

      if(fromGroupId){
        const linkResult=await request({
          url:`/api/collab/group/${fromGroupId}/roadmaps`,method:'POST',
          body:{roadmapId},invalidate:[`group-roadmaps:${fromGroupId}`,'roadmaps'],
        });
        if((linkResult as any).error) throw new Error(apiError((linkResult as any).error));
        if(draft.invitees.length){
          const inviteResult=await request({
            url:`/api/collab/${roadmapId}/group/invite`,method:'POST',
            body:{userIds:draft.invitees.map(x=>x.id),role:draft.inviteRole},
            invalidate:[`group:${roadmapId}`,'notifications'],
          });
          if((inviteResult as any).error) throw new Error(apiError((inviteResult as any).error));
        }
      } else {
        const settings=kind==='team'
          ? {kind:'team',cohort:draft.cohort,accessMode:'invite',directCollaboration:true}
          : {kind:'community',cohort:draft.cohort,accessMode:'request',directCollaboration:false};
        const groupResult=await request({
          url:`/api/collab/${roadmapId}/group`,method:'POST',
          body:{name:draft.name.trim(),description:draft.description.trim(),maxMembers:draft.maxMembers,discoverable:kind==='community',settings},
          invalidate:[`group:${roadmapId}`,'communities','notifications'],
        });
        if((groupResult as any).error) throw new Error(apiError((groupResult as any).error));
        createdGroupId=(groupResult as any).data?.group?.id;
        if(kind==='team' && draft.invitees.length){
          const inviteResult=await request({
            url:`/api/collab/${roadmapId}/group/invite`,method:'POST',
            body:{userIds:draft.invitees.map(x=>x.id),role:draft.inviteRole},
            invalidate:[`group:${roadmapId}`,'notifications'],
          });
          if((inviteResult as any).error) throw new Error(apiError((inviteResult as any).error));
        }
      }
      const target=kind==='team'
        ? (createdGroupId?`/team-activity/${createdGroupId}`:`/collaborate/${roadmapId}`)
        : (createdGroupId?`/community-activity/${createdGroupId}`:`/collaborate/${roadmapId}#community`);
      router.push(target);
    } catch(e){
      setError(e instanceof Error?e.message:'Something went wrong');
    } finally { setSubmitting(false); }
  }

  function apiError(error:any){
    const data=error?.data;
    return typeof data==='string'?data:data?.error||data?.message||'Request failed';
  }

  const canNext = step === 1 ? draft.name.trim().length >= 2 : (roadmapChoice === 'new' ? newRoadmapName.trim().length >= 2 : !!selectedRoadmapId);

  return <AppShell>
    <div className="mx-auto max-w-6xl">
      <Link href={fromGroupId ? (groupRoadmaps[0] ? `/collaborate/${groupRoadmaps[0].id}` : '/collaborate') : '/collaborate'} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"><ArrowLeft size={15}/> Back</Link>
      <header className="mb-7">
        <div className={`mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${kind === 'team' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/35 dark:text-indigo-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300'}`}>
          {kind === 'team' ? <Users size={13}/> : <Globe2 size={13}/>} Create {noun}
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{kind === 'team' ? 'Create your friends team first' : 'Create a public community'}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{kind === 'team' ? 'Name the team, invite your friends, then choose or create the roadmap. Everyone in the team can work directly on the same roadmap and chat together.' : 'The community is public for discovery and viewing. People can request collaborative access, but only the community owner grants editing permissions.'}</p>
      </header>

      {groupLoading ? <Card className="p-10 text-center"><div className="mx-auto size-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"/><p className="mt-3 text-sm text-slate-500">Loading group setup…</p></Card> : error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="mb-6 grid grid-cols-3 gap-2">
        {[['1','Group details'],['2','Roadmap'],['3','Finish']].map(([n,label], i) => <div key={n} className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold ${step === i + 1 ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'border-[hsl(var(--line))] text-slate-400'}`}><span>{n}. {label}</span></div>)}
      </div>

      {step === 1 && <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <div className="flex items-start gap-4"><div className={`grid size-11 shrink-0 place-items-center rounded-2xl text-white ${kind === 'team' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>{kind === 'team' ? <Users size={19}/> : <Globe2 size={19}/>}</div><div><h2 className="text-xl font-semibold">{kind === 'team' ? 'Team identity' : 'Community identity'}</h2><p className="mt-1 text-sm text-slate-500">Examples: <b>10th Boys</b>, <b>Backend Study Circle</b>, <b>Placement Crew</b>.</p></div></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">Name<input value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} placeholder={kind === 'team' ? '10th Boys' : 'Backend Study Circle'} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5 font-normal outline-none"/></label>
            <label className="text-sm font-medium">Configuration / cohort<input value={draft.cohort} onChange={e=>setDraft(v=>({...v,cohort:e.target.value}))} placeholder="2026 batch, school, placement group…" className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5 font-normal outline-none"/></label>
          </div>
          <label className="mt-3 block text-sm font-medium">Description<textarea value={draft.description} onChange={e=>setDraft(v=>({...v,description:e.target.value}))} placeholder={kind === 'team' ? 'A private group of friends learning together.' : 'A public learning community around this roadmap.'} className="mt-1 min-h-24 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5 font-normal outline-none"/></label>
          <label className="mt-3 block max-w-xs text-sm font-medium">Maximum members<input type="number" min={2} max={100} value={draft.maxMembers} onChange={e=>setDraft(v=>({...v,maxMembers:Math.max(2,Math.min(100,Number(e.target.value)||10))}))} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5 font-normal outline-none"/></label>
          <div className="mt-6 flex justify-end"><Button disabled={!canNext} onClick={()=>setStep(2)}>Continue to roadmap <ArrowRight size={15}/></Button></div>
        </Card>

        {kind === 'team' ? <Card className="p-6"><div className="flex items-center justify-between gap-2"><div><h2 className="font-semibold">Invite friends now</h2><p className="mt-1 text-xs text-slate-500">You can also invite later from Group info.</p></div><Badge>{draft.invitees.length} selected</Badge></div><div className="mt-4 flex gap-2"><Search size={15} className="mt-2.5 text-slate-400"/><input value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="Search name or email…" className="min-w-0 flex-1 rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-sm"/></div><div className="mt-3 space-y-2">{memberResults.map(u=><button key={u.id} type="button" onClick={()=>toggleInvitee(u)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${draft.invitees.some(x=>x.id===u.id)?'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20':'border-[hsl(var(--line))]'}`}><span><span className="block text-sm font-medium">{u.fullName}</span><span className="block text-xs text-slate-500">{u.email}</span></span>{draft.invitees.some(x=>x.id===u.id)?<CheckCircle2 size={16} className="text-indigo-600"/>:<UserPlus size={16} className="text-slate-400"/>}</button>)}{memberSearch.length>=2&&!memberResults.length&&<p className="py-5 text-center text-xs text-slate-500">No matching users.</p>}</div>{draft.invitees.length>0&&<div className="mt-4 flex flex-wrap gap-2">{draft.invitees.map(u=><span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-900">{u.fullName}<button onClick={()=>toggleInvitee(u)} aria-label={`Remove ${u.fullName}`}><X size={12}/></button></span>)}</div>}<div className="mt-5"><label className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">Invite role</label><select value={draft.inviteRole} onChange={e=>setDraft(v=>({...v,inviteRole:e.target.value as Draft['inviteRole']}))} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-sm"><option value="viewer">Viewer</option><option value="contributor">Contributor</option><option value="editor">Editor</option></select></div></Card>
        : <Card className="p-6"><div className="flex items-center gap-3"><ShieldCheck className="text-emerald-600"/><div><h2 className="font-semibold">Public by design</h2><p className="mt-1 text-sm text-slate-500">Anyone can discover and view the community roadmap. Collaborative access is a separate permission granted by the owner.</p></div></div><div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300"><div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600"/> Public roadmap visibility</div><div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600"/> Join requests for collaboration</div><div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600"/> Owner-only approval</div><div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600"/> Community chat for members</div></div></Card>}
      </div>}

      {step === 2 && <Card className="p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Choose the roadmap</h2><p className="mt-1 text-sm text-slate-500">The selected roadmap becomes the shared workspace for this {noun}.</p></div><Badge>{roadmaps.length} owned</Badge></div><div className="mt-5 grid gap-3 md:grid-cols-2"><button onClick={()=>setRoadmapChoice('new')} className={`rounded-2xl border p-5 text-left ${roadmapChoice==='new'?'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20':'border-[hsl(var(--line))]'}`}><div className="font-semibold">Create a new roadmap</div><p className="mt-1 text-sm text-slate-500">Start fresh in the visual editor.</p>{roadmapChoice==='new'&&<input autoFocus value={newRoadmapName} onChange={e=>setNewRoadmapName(e.target.value)} onClick={e=>e.stopPropagation()} className="mt-4 w-full rounded-xl border border-[hsl(var(--line))] bg-white px-3 py-2 text-sm dark:bg-slate-950"/>}</button><button onClick={()=>setRoadmapChoice('existing')} className={`rounded-2xl border p-5 text-left ${roadmapChoice==='existing'?'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20':'border-[hsl(var(--line))]'}`}><div className="font-semibold">Use an existing roadmap</div><p className="mt-1 text-sm text-slate-500">Keep the roadmap and move it into this shared flow.</p></button></div>{roadmapChoice==='existing'&&<div className="mt-4"><div className="flex items-center gap-2"><Search size={15} className="text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your roadmaps…" className="min-w-0 flex-1 rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5 text-sm"/></div><div className="mt-3 max-h-80 space-y-2 overflow-auto">{loading?<p className="py-8 text-center text-sm text-slate-500">Loading roadmaps…</p>:filteredRoadmaps.map(r=><button key={r.id} onClick={()=>setSelectedRoadmapId(r.id)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${selectedRoadmapId===r.id?'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20':'border-[hsl(var(--line))]'}`}><span><span className="block text-sm font-semibold">{r.title}</span><span className="block text-xs text-slate-500">{r.description||'Learning roadmap'} · {r._count?.topics??0} topics</span></span>{selectedRoadmapId===r.id?<CheckCircle2 size={17} className="text-indigo-600"/>:<ArrowRight size={15} className="text-slate-400"/>}</button>)}</div></div>}<div className="mt-6 flex justify-between"><Button variant="outline" onClick={()=>setStep(1)}>Back</Button><Button disabled={!canNext} onClick={()=>setStep(3)}>Review & create <ArrowRight size={15}/></Button></div></Card>}

      {step === 3 && <Card className="p-6"><h2 className="text-xl font-semibold">Review {noun}</h2><div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-[hsl(var(--line))] p-4"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Group</div><div className="mt-2 text-lg font-semibold">{draft.name}</div><p className="mt-1 text-sm text-slate-500">{draft.description || 'No description'}</p><div className="mt-3 text-sm text-slate-500">{kind === 'team' ? `Private team · ${draft.invitees.length} initial invite${draft.invitees.length===1?'':'s'} · direct collaboration` : 'Public community · owner-approved collaboration'}</div></div><div className="rounded-xl border border-[hsl(var(--line))] p-4"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Roadmap</div><div className="mt-2 text-lg font-semibold">{roadmapChoice==='new'?newRoadmapName:roadmaps.find(r=>r.id===selectedRoadmapId)?.title}</div><p className="mt-1 text-sm text-slate-500">You will land in the shared workspace after setup.</p></div></div><div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-100">{kind==='team'?<>After creation you are taken directly to the <b>group chat</b>. The same roadmap is shared with your invited friends, and normal team editing needs no approval.</>:<>After creation you are taken to the community workspace. Everyone can view the public roadmap; people request collaborative access, and only you as owner can approve it.</>}</div><div className="mt-6 flex justify-between"><Button variant="outline" onClick={()=>setStep(2)}>Back</Button><Button disabled={submitting} onClick={submit}>{submitting?'Creating…':<>Create {noun} <ArrowRight size={15}/></>}</Button></div></Card>}
    </div>
  </AppShell>;
}

export default function CreateCollaborationPage() {
  return (
    <Suspense fallback={null}>
      <CreateCollaborationContent />
    </Suspense>
  );
}
