import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Card, Button, Badge } from '@/components/ui';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { Users, Plus, ArrowRight, MessageCircle, BarChart3, UserPlus, ShieldCheck } from 'lucide-react';
import { GroupInviteButton } from '@/components/group-invite-button';

type CollaborationGroup = { id: string; roadmapId: string; ownerId: string; name: string; description: string; maxMembers: number; settings: unknown; roadmap: { id: string; title: string; description: string; privacy: string } | null; _count: { members: number } };
type CollaborationRoadmap = { id: string; title: string; description: string; privacy: string };

export default async function CollaborationIndex() {
  const user = await requireUser();
  const roadmaps: CollaborationRoadmap[] = await withRls(user.id, tx => tx.roadmap.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, description: true, privacy: true } }));
  const groups: CollaborationGroup[] = await withRls(user.id, tx => tx.collabGroup.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    include: { roadmap: { select: { id: true, title: true, description: true, privacy: true } }, _count: { select: { members: true } } },
    orderBy: { updatedAt: 'desc' },
  }));
  const teams = groups.filter((g: CollaborationGroup)=>{ const s=g.settings&&typeof g.settings==='object'?g.settings as Record<string,unknown>:{}; return s.kind==='team'; });
  const groupByRoadmap = new Map(teams.filter((g: CollaborationGroup)=>g.ownerId===user.id).map((g: CollaborationGroup)=>[g.roadmapId,g]));

  return <AppShell>
    <div className="teams-landing mx-auto max-w-7xl">
      <section className="teams-hero">
        <div className="teams-hero-copy">
          <span className="teams-eyebrow"><Users size={14}/> Teams</span>
          <div className="text-4xl font-bold">Roadmaps for Teams</div>
          <p>Train, plan and track your group's skills and career growth on one shared roadmap.</p>
          <ul className="teams-benefits"><li><ShieldCheck size={17}/> Create custom roadmaps for your group</li><li><ShieldCheck size={17}/> Invite teammates and keep everyone aligned</li><li><ShieldCheck size={17}/> Work together with direct editing and chat</li><li><ShieldCheck size={17}/> Add more roadmaps as the group grows</li></ul>
        </div>
        <div className="public-hero-actions">
          <a href="/roadmap" className="primary-cta"><Plus size={15}/> Create your own roadmap</a>
          <Link href="/collaborate/create?type=team" className="teams-primary-cta"><Plus size={16}/> Create your Team</Link>
          {/* <a href="/collaborate/create?type=community" className="secondary-cta">Create a community</a> */}
        </div>
        {/* <div className="teams-hero-preview" aria-hidden="true"><div className="teams-preview-label">Your group</div><div className="teams-preview-title">Junior Full Stack Developer</div><div className="teams-preview-spine"/><div className="teams-preview-node a">HTML</div><div className="teams-preview-node b">CSS</div><div className="teams-preview-node c">JavaScript</div><div className="teams-preview-node child one">Learn</div><div className="teams-preview-node child two">Make layouts</div><div className="teams-preview-node child three">Responsive design</div><svg className="teams-preview-lines" viewBox="0 0 620 360" fill="none"><path d="M270 95 C320 95 340 125 380 125"/><path d="M270 145 C320 145 340 165 380 165"/><path d="M270 195 C320 195 340 205 380 205"/></svg></div> */}
        {/* <section className="teams-feature-section"><div className="teams-section-heading"><h2>Track and guide your team's knowledge</h2><p>Individual and team-level growth plans, progress tracking, skill gaps, collaboration and chat.</p></div><div className="teams-feature-grid"><Card className='p-4'><div className="teams-feature-icon"><Users size={18}/></div><h3>One shared roadmap</h3><p>Everyone edits the same roadmap directly. No merge approvals for normal team work.</p></Card><Card><div className="teams-feature-icon"><MessageCircle size={18}/></div><h3>Team chat</h3><p>Discuss tasks, resources and roadmap decisions without leaving the workspace.</p></Card><Card><div className="teams-feature-icon"><BarChart3 size={18}/></div><h3>Progress visibility</h3><p>See what the group is learning, what is completed and what comes next.</p></Card></div></section> */}
      </section>
      <section className="mt-10"><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Teams you belong to</h2><p className="text-sm text-slate-500">Open a team to enter its Team Activity workspace.</p></div><Badge>{teams.length} teams</Badge></div>{teams.length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{teams.map((g: CollaborationGroup)=>{const s=g.settings&&typeof g.settings==='object'?g.settings as Record<string,unknown>:{}; const direct=s.directCollaboration===true; const href=direct?`/team-activity/${g.id}`:`/collaborate/${g.roadmapId}`; return <Card key={g.id} className="group-card p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate font-semibold">{g.name}</h3><Badge>Friends team</Badge></div><p className="mt-1 text-xs text-slate-500">{g.roadmap?.title||'No roadmap attached'} · {g._count.members} member{g._count.members===1?'':'s'}</p></div><Badge>{g.ownerId===user.id?'Owner':'Member'}</Badge></div><div className="mt-4 flex flex-wrap items-center gap-2"><Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">Open Team Activity <ArrowRight size={14}/></Link><GroupInviteButton groupId={g.id} roadmapId={g.roadmapId} groupName={g.name} groupKind="team" canInvite /></div></Card>})}</div>:<Card className="p-10 text-center text-sm text-slate-500">You have no teams yet. Create one and invite your friends.</Card>}</section>
      <section className="mt-10"><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Your roadmaps</h2><p className="text-sm text-slate-500">Create a team around a roadmap or open an existing team workspace.</p></div><Badge>{roadmaps.length} roadmaps</Badge></div>{roadmaps.length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{roadmaps.map((r: CollaborationRoadmap)=>{const g=groupByRoadmap.get(r.id); return <Card key={r.id} className="group-card p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{r.title}</h3><p className="mt-1 line-clamp-2 text-xs text-slate-500">{r.description||'Roadmap collaboration workspace.'}</p></div><Badge>{r.privacy}</Badge></div><Link href={g?`/team-activity/${g.id}`:`/collaborate/create?type=team&roadmapId=${r.id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">{g?'Open Team Activity':'Create team from this roadmap'} <ArrowRight size={14}/></Link></Card>})}</div>:<Card className="p-10 text-center text-sm text-slate-500">Create a roadmap from the app bar to get started.</Card>}</section>
    </div>
  </AppShell>;
}
