'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card } from '@/components/ui';
import { ArrowLeft, ExternalLink, MessageCircle, Users, Eye, GripVertical, Maximize2, Minimize2, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen, UserPlus, Settings2, X } from 'lucide-react';
import { GroupChat } from '@/components/group-chat';
import { RoadmapTree } from '@/components/roadmap-tree';
import { useLazyGetJsonQuery } from '@/lib/redux/api';

type Props = {
  groupId: string;
  roadmapId: string;
  groupName: string;
  groupDescription: string;
  memberRole: string;
  maxMembers: number;
  isOwner?: boolean;
  kind?: 'team' | 'community';
};

export function TeamActivityWorkspace({ groupId, roadmapId, groupName, groupDescription, memberRole, maxMembers, isOwner = false, kind = 'team' }: Props) {
  const [activePane, setActivePane] = useState<'chat' | 'roadmap'>('roadmap');
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [roadmapCollapsed, setRoadmapCollapsed] = useState(false);
  const [split, setSplit] = useState(38);
  const [manageOpen, setManageOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [limit, setLimit] = useState(maxMembers);
  const [manageBusy, setManageBusy] = useState(false);
  const [manageNotice, setManageNotice] = useState('');
  const draggingRef = useRef(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const readOnly = true;
  const isCommunity = kind === 'community';
  const workspaceTitle = isCommunity ? 'Community Activity' : 'Team Activity';
  const workspaceLabel = isCommunity ? 'Community' : 'Team';
  const chatLabel = isCommunity ? 'Community Chat' : 'Group Chat';
  const roadmapDescription = isCommunity
    ? 'The public roadmap is visible to everyone; this workspace is available to members with collaboration access.'
    : 'View the shared team roadmap here. Use Full editor when you want to make changes.';
  const backHref = isCommunity ? '/community?tab=communities' : `/collaborate/${roadmapId}`;
  const editorHref = isCommunity ? `/community-activity/${groupId}/editor` : `/roadmap/${roadmapId}`;

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!draggingRef.current || chatCollapsed || roadmapCollapsed || !shellRef.current) return;
    const rect = shellRef.current.getBoundingClientRect();
    const raw = ((event.clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(25, Math.min(65, raw)));
  }, [chatCollapsed, roadmapCollapsed]);

  const stopDragging = useCallback(() => {
    draggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDragging);
    };
  }, [onPointerMove, stopDragging]);

  const startDragging = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (chatCollapsed || roadmapCollapsed) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const gridTemplateColumns = chatCollapsed
    ? '52px minmax(0, 1fr)'
    : roadmapCollapsed
      ? 'minmax(0, 1fr) 52px'
      : `${split}fr 12px ${100 - split}fr`;

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-5rem)] overflow-x-hidden">
        <header className="sticky top-0 z-20 border-b border-[hsl(var(--line))] bg-[hsl(var(--bg)/.92)] backdrop-blur">
          <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3 md:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <a href={backHref} className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--line))] px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"><ArrowLeft size={13}/> Workspace</a>
                <Badge>{workspaceTitle}</Badge>
                <span className="truncate text-lg font-semibold">{groupName}</span>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-slate-500">{groupDescription || (isCommunity ? 'Public community with permission-based roadmap collaboration.' : 'Private friends team with direct roadmap collaboration.')}</p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Badge>{isCommunity ? 'Public' : memberRole}</Badge>
              {isCommunity ? <Badge>Collaboration access granted</Badge> : <Badge>{maxMembers} max</Badge>}
              {isCommunity && isOwner && <>
                <button type="button" onClick={() => { setLimit(maxMembers); setManageNotice(''); setManageOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--line))] px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"><Settings2 size={13}/> Change limit</button>
                <button type="button" onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"><UserPlus size={13}/> Invite</button>
              </>}
              <a href={editorHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white"><ExternalLink size={13}/> Full editor</a>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1800px] px-3 py-3 md:hidden">
          <div className="grid grid-cols-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] p-1">
            <button onClick={() => setActivePane('chat')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activePane === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><MessageCircle size={14} className="mr-1 inline"/>Chat</button>
            <button onClick={() => setActivePane('roadmap')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activePane === 'roadmap' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><Users size={14} className="mr-1 inline"/>Roadmap</button>
          </div>
        </div>
        {isCommunity && isOwner && <div className="mx-auto flex max-w-[1800px] gap-2 px-3 pb-3 md:hidden">
          <button type="button" onClick={() => { setLimit(maxMembers); setManageNotice(''); setManageOpen(true); }} className="flex-1 rounded-xl border border-[hsl(var(--line))] px-3 py-2 text-xs font-semibold"><Settings2 size={13} className="mr-1 inline"/>Change limit</button>
          <button type="button" onClick={() => setInviteOpen(true)} className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"><UserPlus size={13} className="mr-1 inline"/>Invite</button>
        </div>}

        <main className="mx-auto max-w-[1800px] px-3 pb-6 md:px-6">
          <div ref={shellRef} className="team-activity-split" style={{ gridTemplateColumns }} aria-label="Team Activity workspace">
            <section className={`team-activity-pane team-activity-chat ${activePane === 'chat' ? 'is-active' : ''} ${chatCollapsed ? 'is-collapsed' : ''}`}>
              <Card className="team-activity-card">
                <div className="team-activity-card-head">
                  {chatCollapsed ? <button className="team-pane-expand" title="Expand chat" onClick={() => setChatCollapsed(false)}><PanelLeftOpen size={16}/></button> : <><div><div className="font-semibold">{chatLabel}</div><div className="text-[11px] text-slate-500">{isCommunity ? 'Talk with community members while working from the same public roadmap.' : 'Talk with the team while staying on the same roadmap.'}</div></div><div className="flex items-center gap-1.5"><Badge><MessageCircle size={12} className="mr-1 inline"/> Live</Badge><button className="team-pane-control" title="Minimize chat" onClick={() => setChatCollapsed(true)}><PanelLeftClose size={15}/></button></div></>}
                </div>
                {!chatCollapsed && <div className="team-activity-card-body team-chat-body"><GroupChat roadmapId={roadmapId} label={chatLabel} description={isCommunity ? 'Talk with community members while working from the same public roadmap.' : 'Talk with the team while staying on the same roadmap.'}/></div>}
              </Card>
            </section>

            {!chatCollapsed && !roadmapCollapsed && <button className="team-pane-resizer" onPointerDown={startDragging} aria-label="Resize chat and roadmap panels" title="Drag to resize"><GripVertical size={16}/></button>}

            <section className={`team-activity-pane team-activity-roadmap ${activePane === 'roadmap' ? 'is-active' : ''} ${roadmapCollapsed ? 'is-collapsed' : ''}`}>
              <Card className="team-activity-card">
                <div className="team-activity-card-head">
                  {roadmapCollapsed ? <button className="team-pane-expand" title="Expand roadmap" onClick={() => setRoadmapCollapsed(false)}><PanelRightOpen size={16}/></button> : <><div><div className="font-semibold">Shared Roadmap</div><div className="text-[11px] text-slate-500">{roadmapDescription}</div></div><div className="flex items-center gap-1.5"><Badge>View only</Badge><button className="team-pane-control" title="Minimize roadmap" onClick={() => setRoadmapCollapsed(true)}><PanelRightClose size={15}/></button><button className="team-pane-control" title="Reset pane sizes" onClick={() => setSplit(38)}><Maximize2 size={14}/></button><a href={editorHref} target="_blank" rel="noreferrer" className="hidden rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white sm:inline-flex"><ExternalLink size={13} className="mr-1"/> Editor</a></div></>}
                </div>
                {!roadmapCollapsed && <div className="team-activity-card-body team-roadmap-body"><RoadmapTree sharedRoadmapId={roadmapId} viewOnly /></div>}
              </Card>
            </section>
          </div>
        </main>
      </div>

      {isCommunity && isOwner && manageOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Community member limit</h2><p className="mt-1 text-xs text-slate-500">Only the community owner can change capacity.</p></div><button onClick={() => setManageOpen(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-900"><X size={16}/></button></div>
            <label className="mt-5 block text-sm font-medium">Maximum members<input type="number" min={Math.max(2, 1)} max={100} value={limit} onChange={e => setLimit(Math.max(2, Math.min(100, Number(e.target.value) || 2)))} className="mt-2 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2" /></label>
            {manageNotice && <p className="mt-3 text-xs text-red-500">{manageNotice}</p>}
            <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setManageOpen(false)}>Cancel</Button><Button disabled={manageBusy} onClick={async()=>{setManageBusy(true);setManageNotice('');try{const r=await fetch(`/api/collab/${roadmapId}/group`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({maxMembers:limit})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.error||'Could not update limit');setManageOpen(false);location.reload();}catch(e){setManageNotice(e instanceof Error?e.message:'Could not update limit')}finally{setManageBusy(false)}}}>{manageBusy?'Saving…':'Save limit'}</Button></div>
          </div>
        </div>
      )}
      {isCommunity && isOwner && inviteOpen && (
        <CommunityInviteModal roadmapId={roadmapId} groupId={groupId} groupName={groupName} onClose={() => setInviteOpen(false)} />
      )}
    </AppShell>
  );
}

function CommunityInviteModal({ roadmapId, groupId, groupName, onClose }: { roadmapId: string; groupId: string; groupName: string; onClose: () => void }) {
  const [query,setQuery]=useState(''); const [selected,setSelected]=useState<string[]>([]); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState('');
  const [searchUsers, searchUsersState] = useLazyGetJsonQuery();
  const users = (((searchUsersState.data as any)?.users || []) as any[]);
  useEffect(()=>{const q=query.trim(); if(q.length<2)return; const t=setTimeout(()=>{void searchUsers({url:`/api/users/search?q=${encodeURIComponent(q)}`,tag:`users:${q.toLowerCase()}`})},300);return()=>clearTimeout(t)},[query,searchUsers]);
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-xl rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">Invite to {groupName}</h2><p className="mt-1 text-xs text-slate-500">Community owners can grant collaboration access directly.</p></div><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-900"><X size={16}/></button></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name or email…" className="mt-4 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-sm" autoFocus/><div className="mt-3 max-h-60 space-y-2 overflow-auto">{users.map(u=><button key={u.id} onClick={()=>setSelected(x=>x.includes(u.id)?x.filter(id=>id!==u.id):[...x,u.id])} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${selected.includes(u.id)?'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30':'border-[hsl(var(--line))]'}`}><span><span className="block text-sm font-medium">{u.fullName}</span><span className="block text-xs text-slate-500">{u.email}</span></span>{selected.includes(u.id)&&<span className="text-xs font-semibold text-indigo-600">Selected</span>}</button>)}</div>{notice&&<p className="mt-3 text-xs text-red-500">{notice}</p>}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy||!selected.length} onClick={async()=>{setBusy(true);setNotice('');try{const r=await fetch(`/api/collab/${roadmapId}/group/invite`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userIds:selected,role:'contributor'})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.error||'Could not invite members.');onClose();}catch(e){setNotice(e instanceof Error?e.message:'Could not invite members.')}finally{setBusy(false)}}}>{busy?'Inviting…':'Send invites'}</Button></div></div></div>
}

