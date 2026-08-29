'use client';

import { useMemo, useState } from 'react';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card } from '@/components/ui';
import { ArrowRight, Clock3, Globe2, Search, Star, Users, Plus, ShieldCheck } from 'lucide-react';

type Group={id:string;name:string;description:string;maxMembers:number;memberCount:number;ownerId:string;isOwner:boolean;kind:'community'|'team';accessMode:'invite'|'request'|'open';directCollaboration:boolean;roadmap:{id:string;title:string;description:string;privacy:string};membership:{role:string}|null;pending:boolean};
type PublicRoadmap={id:string;title:string;description:string;updatedAt:string;_count:{topics:number};communityGroup:{id:string;name:string;maxMembers:number;_count:{members:number}}|null;shareSlug?:string|null};

export default function Community(){
  const [query,setQuery]=useState('');
  const [submittedQuery,setSubmittedQuery]=useState('');
  const [busy,setBusy]=useState<string|null>(null);
  const [requestAction]=useRequestMutation();

  const groupsQuery=useGetJsonQuery({url:`/api/communities?q=${encodeURIComponent(submittedQuery)}`,tag:'communities'});
  const roadmapsQuery=useGetJsonQuery({url:`/api/public-roadmaps?q=${encodeURIComponent(submittedQuery)}`,tag:'public-roadmaps'});
  const groups=(((groupsQuery.data as any)?.groups||[]) as Group[]);
  const roadmaps=(((roadmapsQuery.data as any)?.roadmaps||[]) as PublicRoadmap[]);
  const loading=groupsQuery.isLoading||roadmapsQuery.isLoading;

  async function request(group:Group){
    setBusy(group.id);
    try{
      await requestAction({
        url:`/api/collab/${group.roadmap.id}/group/request`,
        method:'POST',
        body:{message:'I would like to learn and contribute to this public community roadmap.'},
        invalidate:['communities','public-roadmaps','notifications'],
      }).unwrap();
    } catch(e){ alert(e instanceof Error?e.message:'Could not request access'); }
    finally { setBusy(null); }
  }

  const filteredCommunities=useMemo(()=>groups.filter(g=>g.kind==='community'),[groups]);

  return <AppShell>
    <div className="public-discovery-page mx-auto max-w-7xl">
      <section className="public-discovery-hero">
        <div className="public-discovery-hero-copy">
          <span className="public-eyebrow"><Globe2 size={14}/> Community</span>
          <h2 className="text-4xl font-bold">Community Roadmaps</h2>
          <p>A curated space for public roadmaps created by learners, builders and the wider community.</p>
          <div className="public-hero-actions">
            <a href="/roadmap" className="primary-cta"><Plus size={15}/> Create your own roadmap</a>
            <a href="/collaborate/create?type=community" className="secondary-cta">Create a community</a>
          </div>
        </div>
        <div className="public-discovery-hero-stats">
          <div><strong>{roadmaps.length}</strong><span>Public roadmaps</span></div>
          <div><strong>{filteredCommunities.length}</strong><span>Public communities</span></div>
          <div><em>Open</em><span>View for everyone</span></div>
        </div>
      </section>

      <section className="public-discovery-controls">
        <form onSubmit={e=>{e.preventDefault();setSubmittedQuery(query.trim())}} className="public-discovery-search">
          <Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search public roadmaps, topics or communities…"/><Button type="submit">Search</Button>
        </form>
        <div className="public-result-meta"><span>{roadmaps.length} results found</span><span className="public-sort-pill">Newest <Clock3 size={13}/></span></div>
      </section>

      <section className="public-section">
        <div className="public-section-heading"><div><h2>Community roadmaps</h2><p>Discover public learning paths. Viewing is open; collaboration access is granted separately.</p></div><Badge>{roadmaps.length}</Badge></div>
        {loading ? <Card className="p-12 text-center text-sm text-slate-500">Loading public roadmaps…</Card> : <div className="public-roadmap-grid">{roadmaps.map(r=><Card key={r.id} className="public-roadmap-card">
          <div className="public-roadmap-card-top"><div><span className="public-card-label">PUBLIC</span><h3>{r.title}</h3></div><div className="public-card-icon"><Globe2 size={17}/></div></div>
          <p>{r.description||'Community-created learning roadmap.'}</p>
          <div className="public-roadmap-card-footer"><span><Users size={13}/>{r._count?.topics||0}</span><span><Star size={13} fill="currentColor"/> 5.0</span><a href={r.shareSlug?`/share/${r.shareSlug}`:`/roadmap/${r.id}/live`}>View roadmap <ArrowRight size={13}/></a></div>
        </Card>)}{!roadmaps.length&&<Card className="col-span-full p-12 text-center text-sm text-slate-400">No public roadmaps match this search.</Card>}</div>}
      </section>

      <section className="public-section public-community-section">
        <div className="public-section-heading"><div><h2>Public communities</h2><p>Everyone can discover these communities. Roadmap viewing is available after your collaboration request is approved.</p></div><Badge>{filteredCommunities.length}</Badge></div>
        <div className="public-community-grid">{filteredCommunities.map(g=>{const full=g.memberCount>=g.maxMembers; return <Card key={g.id} className="public-community-card"><div className="public-community-card-head"><div className="public-card-icon public-card-icon-green"><ShieldCheck size={17}/></div><div className="min-w-0"><h3>{g.name}</h3><p>{g.roadmap?.title||'Public roadmap'}</p></div><Badge>Public</Badge></div><p className="public-community-description">{g.description||'A public learning community around a shared roadmap.'}</p><div className="public-community-meta"><span><Users size={13}/>{g.memberCount}/{g.maxMembers}</span><span>Owner approval</span></div><div className="public-community-actions">{(g.membership || g.isOwner) ? <a href={`/community-activity/${g.id}`} className="primary-cta compact">Open community <ArrowRight size={13}/></a>:g.pending?<span className="request-pending">Request pending</span>:<Button disabled={full||busy===g.id} onClick={()=>void request(g)}>{full?'Community full':busy===g.id?'Requesting…':'Request collaboration'}</Button>}{(g.membership || g.isOwner) && <a href={`/community-activity/${g.id}#roadmap`} className="secondary-cta compact">View roadmap <ArrowRight size={13}/></a>}</div></Card>})}{!filteredCommunities.length&&<Card className="col-span-full p-10 text-center text-sm text-slate-400">No public communities match this search.</Card>}</div>
      </section>
    </div>
  </AppShell>
}
