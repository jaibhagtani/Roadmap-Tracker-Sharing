'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import { Plus, Trash2, Save, Share2, ExternalLink, Search, Maximize2, Minimize2, PanelRight } from 'lucide-react';
import { Button, Card, Badge } from './ui';
import { RoadmapVisualCanvas } from './studio-canvas';
import { SyncRoadmapButton } from './sync-roadmap-button';

type Resource = {
  id: string;
  title: string;
  url: string;
  type: string;
  notes: string;
  completed: boolean;
  favorite: boolean;
};

type Topic = {
  id: string;
  roadmapId: string;
  parentId: string | null;
  title: string;
  description: string;
  notes: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number;
  priority: number;
  position: number;
  tags: string[];
  dueDate: string | null;
  shareToken?: string | null;
  resources: Resource[];
};

type PersonalStatus = 'learning' | 'done' | 'skipped';

type Roadmap = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  privacy: 'private' | 'link' | 'public';
  shareSlug: string;
  shareToken?: string | null;
  version: number;
  topics: Topic[];
  editorState?: any;
};

type Node = Topic & { children: Node[] };

function treeify(topics: Topic[]) {
  const map = new Map<string, Node>();
  topics.forEach(t => map.set(t.id, { ...t, children: [] }));
  const roots: Node[] = [];

  topics.forEach(t => {
    const node = map.get(t.id)!;
    if (t.parentId && map.has(t.parentId)) {
      map.get(t.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sort = (list: Node[]) => {
    list.sort((a, b) => a.position - b.position);
    list.forEach(item => sort(item.children));
  };

  sort(roots);
  return roots;
}

function calcProgress(topics: Topic[]) {
  return topics.length ? Math.round(topics.reduce((sum, item) => sum + item.progress, 0) / topics.length) : 0;
}

export function RoadmapTree({ sharedRoadmapId, branchId, viewOnly = false }: { sharedRoadmapId?: string; branchId?: string; viewOnly?: boolean } = {}) {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [shareId, setShareId] = useState('');
  const [shareRole, setShareRole] = useState<'contributor'|'viewer'>('contributor');
  const [branchName, setBranchName] = useState('');
  const [notice, setNotice] = useState('');
  const [permission, setPermission] = useState<'owner'|'leader'|'editor'|'contributor'|'topic_editor'|'viewer'|'none'>('owner');
  const [directGroup, setDirectGroup] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const syncVersionRef = useRef(0);
  const loadRef = useRef<(preferred?: string) => Promise<void>>(async () => {});
  const permissionRef = useRef<typeof permission>('owner');
  const [collaborators, setCollaborators] = useState<{userId:string;lastSeen:string}[]>([]);
  const [members, setMembers] = useState<any>({roadmapMembers:[],topicMembers:[]});
  const [searchTerm, setSearchTerm] = useState('');
  const [personalProgress, setPersonalProgress] = useState<Record<string, { status: PersonalStatus; updatedAt: string | null }>>({});
  const [progressSaving, setProgressSaving] = useState(false);

  const updateSyncVersion = (version: number) => {
    syncVersionRef.current = version;
    setSyncVersion(prev => prev === version ? prev : version);
  };

  async function call(url: string, method: string, body?: any) {
    const r = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!r.ok) {
      const message = await r.text();
      if (r.status === 409) {
        const target = sharedRoadmapId || roadmap?.id;
        if (target) await load(target);
        flash('Someone changed this roadmap. Latest version loaded.');
      }
      throw new Error(message);
    }
    return r.json();
  }

  async function load(preferred?: string, forceSync = false) {
    setLoading(true);
    try {
      if (branchId && sharedRoadmapId) {
        const data = await call(`/api/collab/${sharedRoadmapId}/branches/${branchId}`, 'GET');
        const branchRoadmap = { ...data.roadmap.roadmap, version: data.branch.version, topics: data.roadmap.topics };
        setRoadmaps([branchRoadmap]);
        setRoadmap(branchRoadmap);
        setPermission(data.role);
        setDirectGroup(false);
        setBranchName(data.branch.name);
        updateSyncVersion(data.branch.version ?? 0);
        setSelected(value => value && branchRoadmap.topics.some((t: Topic) => t.id === value) ? value : branchRoadmap.topics[0]?.id ?? null);
        return;
      }
      if (sharedRoadmapId) {
        const data = await call(`/api/shared/access?roadmapId=${sharedRoadmapId}`, 'GET');
        setRoadmaps([data.roadmap]);
        setRoadmap(data.roadmap);
        setPermission(data.role);
        setDirectGroup(Boolean(data.directGroup));
        setPersonalProgress(Object.fromEntries((data.personalProgress ?? []).map((p:any) => [p.topicId, { status: p.status as PersonalStatus, updatedAt: p.updatedAt ?? null }])));
        updateSyncVersion(data.roadmap.version ?? 0);
        setSelected(value => value && data.roadmap.topics.some((t: Topic) => t.id === value)
          ? value
          : data.roadmap.topics[0]?.id ?? null);
        return;
      }
      const list = await call('/api/roadmaps', 'GET');
      const nextRoadmaps = list.roadmaps ?? [];
      setRoadmaps(nextRoadmaps);

      const id = preferred ?? nextRoadmaps[0]?.id;
      if (!id) {
        setRoadmap(null);
        setSelected(null);
        return;
      }

      const data = await call(`/api/roadmaps/${id}`, 'GET');
      setRoadmap(data.roadmap);
      setPermission('owner');
      setDirectGroup(false);
      updateSyncVersion(data.roadmap.version ?? 0);
      setSelected(value => value && data.roadmap.topics.some((t: Topic) => t.id === value)
        ? value
        : data.roadmap.topics[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [sharedRoadmapId, branchId]);

  const roots = useMemo(() => (roadmap ? treeify(roadmap.topics) : []), [roadmap]);
  const current = roadmap?.topics.find(t => t.id === selected) ?? null;
  const currentProgressQuery = useGetJsonQuery(
    { url:current?.id ? `/api/topics/${current.id}/progress` : '/api/topics/__empty__/progress', tag:current?.id ? `topic-progress:${current.id}` : 'topic-progress-empty' },
    { skip:!current?.id }
  );
  const [progressRequest] = useRequestMutation();
  const currentProgressStatus = ((currentProgressQuery.data as any)?.progress?.status || personalProgress[current?.id || '']?.status || 'learning') as PersonalStatus;
  const canEdit = !viewOnly && (!!branchId ? (permission === 'owner' || permission === 'contributor' || permission === 'topic_editor') : (permission === 'owner' || permission === 'editor' || (directGroup && permission === 'contributor')));
  const canEditRoadmap = !viewOnly && (!!branchId ? (permission === 'owner' || permission === 'contributor') : (permission === 'owner' || permission === 'editor' || (directGroup && permission === 'contributor')));

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 1800);
  };

  function mutationUrl() {
    if (!roadmap) return '';
    return branchId ? `/api/collab/${roadmap.id}/branches/${branchId}/apply` : `/api/collab/${roadmap.id}/apply`;
  }

  async function commitAndPush() {
    if (!branchId || !sharedRoadmapId) return;
    const message = prompt('Commit message', 'Update roadmap');
    if (!message?.trim()) return;
    const response = await fetch(`/api/collab/${sharedRoadmapId}/commits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branchId, message: message.trim() }) });
    if (!response.ok) return alert(await response.text());
    flash('Commit pushed for leader review');
  }

  async function syncLatest() {
    const target = sharedRoadmapId || roadmap?.id;
    if (!target) return;
    await load(target, true);
    flash('Latest roadmap synced');
  }

  loadRef.current = load;
  permissionRef.current = permission;

  async function createRoadmap() {
    const name = prompt('Roadmap name');
    if (!name?.trim()) return;
    const j = await call('/api/roadmaps', 'POST', { title: name.trim() });
    await load(j.roadmap.id);
  }

  async function setPersonalStatus(status: PersonalStatus) {
    if (!current || progressSaving) return;
    setProgressSaving(true);
    const previous = currentProgressStatus;
    setPersonalProgress(prev => ({ ...prev, [current.id]: { status, updatedAt: new Date().toISOString() } }));
    try {
      const result=await progressRequest({
        url:`/api/topics/${current.id}/progress`,
        method:'PATCH',
        body:{status},
        invalidate:[`topic-progress:${current.id}`],
      });
      if((result as any).error) throw new Error((result as any).error?.data?.error || 'Could not update progress');
      const progressData=(result as any).data?.progress;
      if(progressData) setPersonalProgress(prev => ({ ...prev, [current.id]: { status: progressData.status, updatedAt: progressData.updatedAt ?? null } }));
    } catch (e) {
      setPersonalProgress(prev => ({ ...prev, [current.id]: { status: previous, updatedAt: prev[current.id]?.updatedAt ?? null } }));
      flash(e instanceof Error ? e.message : 'Could not update progress');
    } finally { setProgressSaving(false); }
  }

  async function addTopic(parentId: string | null) {
    if (!roadmap || !canEdit) return;
    const name = prompt(parentId ? 'Child topic name' : 'Top-level topic name');
    if (!name?.trim()) return;

    const j = await call(mutationUrl(), 'POST', { expectedVersion: syncVersion, op: 'topic:create', payload: { parentId, title: name.trim() } });
    // update local state optimistically
    setRoadmap(prev => prev ? { ...prev, topics: [...prev.topics, j.topic] } : prev);
    setSelected(j.topic.id);
    updateSyncVersion(j.version ?? syncVersion);
    if (parentId) setOpen(o => ({ ...o, [parentId]: true }));
  }

  async function saveRoadmap() {
    if (!roadmap || !canEditRoadmap) return;
    const j = await call(mutationUrl(), 'POST', { expectedVersion: syncVersion, op: 'roadmap:update', payload: { data: { title: roadmap.title, description: roadmap.description, privacy: roadmap.privacy } } });
    setRoadmap(prev => prev ? { ...prev, ...j.roadmap } : prev);
    updateSyncVersion(j.version ?? syncVersion);
    flash('Roadmap saved');
  }

  async function saveTopic() {
    if (!current || !roadmap || !canEdit) return;
    const j = await call(mutationUrl(), 'POST', { expectedVersion: syncVersion, op: 'topic:update', payload: { id: current.id, data: { title: current.title, description: current.description, notes: current.notes, status: current.status, progress: current.progress, priority: current.priority, tags: current.tags, dueDate: current.dueDate } } });

    setRoadmap(prev => prev ? {
      ...prev,
      topics: prev.topics.map(t => t.id === current.id ? { ...t, ...j.topic } : t),
    } : prev);
    updateSyncVersion(j.version ?? syncVersion);
    flash('Topic saved');
  }

  async function deleteTopic() {
    if (!current || !roadmap || !canEdit || !confirm(`Delete “${current.title}” and everything under it?`)) return;
    const j = await call(mutationUrl(), 'POST', { expectedVersion: syncVersion, op: 'topic:delete', payload: { id: current.id } });
    updateSyncVersion(j.version ?? syncVersion);
    await load(roadmap.id);
    setSelected(null);
    flash('Topic deleted');
  }

  async function addResource() {
    if (!current || !roadmap || !canEdit) return;
    const title = prompt('Resource title');
    if (!title?.trim()) return;
    const url = prompt('Resource URL');
    if (!url?.trim()) return;

    const j = await call(mutationUrl(), 'POST', { expectedVersion: syncVersion, op: 'resource:create', payload: { topicId: current.id, title: title.trim(), url: url.trim() } });

    setRoadmap(prev => prev ? {
      ...prev,
      topics: prev.topics.map(t => t.id === current.id ? { ...t, resources: [...t.resources, j.resource] } : t),
    } : prev);
    updateSyncVersion(j.version ?? syncVersion);
  }

  async function editResource(r: Resource) {
    const title = prompt('Resource title', r.title);
    if (title === null) return;
    const url = prompt('Resource URL', r.url);
    if (url === null) return;

    if (!roadmap || !canEdit) return;
    const j = await call(mutationUrl(), 'POST', { expectedVersion: syncVersion, op: 'resource:update', payload: { id: r.id, data: { title, url, completed: r.completed, favorite: r.favorite, notes: r.notes } } });

    setRoadmap(prev => prev ? {
      ...prev,
      topics: prev.topics.map(t => t.id === current?.id ? {
        ...t,
        resources: t.resources.map(x => x.id === r.id ? { ...x, ...j.resource } : x),
      } : t),
    } : prev);
    updateSyncVersion(j.version ?? syncVersion);
  }

  async function toggleResource(r: Resource, key: 'completed' | 'favorite') {
    if (!current || !roadmap || !canEdit) return;
    const j = await call(mutationUrl(), 'POST', { expectedVersion: syncVersion, op: 'resource:update', payload: { id: r.id, data: { [key]: !r[key] } } });

    setRoadmap(prev => prev ? {
      ...prev,
      topics: prev.topics.map(t => t.id === current.id ? {
        ...t,
        resources: t.resources.map(x => x.id === r.id ? { ...x, ...j.resource } : x),
      } : t),
    } : prev);
    updateSyncVersion(j.version ?? syncVersion);
  }

  async function deleteResource(r: Resource) {
    if (!current || !roadmap || !canEdit || !confirm('Delete this resource?')) return;
    const j = await call(mutationUrl(), 'POST', { expectedVersion: syncVersion, op: 'resource:delete', payload: { id: r.id } });

    setRoadmap(prev => prev ? {
      ...prev,
      topics: prev.topics.map(t => t.id === current.id ? {
        ...t,
        resources: t.resources.filter(x => x.id !== r.id),
      } : t),
    } : prev);
    updateSyncVersion(j.version ?? syncVersion);
  }

  async function sendShare(scopeType: 'roadmap' | 'topic') {
    if (!roadmap || !shareId.trim() || !canEditRoadmap) return;

    await call('/api/share-requests', 'POST', {
      scopeType,
      roadmapId: roadmap.id,
      rootTopicId: scopeType === 'topic' ? current?.id : null,
      receiverId: shareId.trim(),
      role: shareRole,
      message: scopeType === 'topic'
        ? `You have been invited to view “${current?.title}” and all of its children.`
        : `You have been invited to view “${roadmap.title}”.`,
    });

    setShareId('');
    flash(scopeType === 'topic' ? 'Layer share request sent' : 'Roadmap share request sent');
  }

  async function dropTopic(targetId: string, sourceId: string) {
    if (!roadmap || !canEdit || targetId === sourceId) return;
    const target = roadmap.topics.find(t => t.id === targetId);
    if (target?.parentId === sourceId) return;

    try {
      const j = await call(mutationUrl(), 'POST', { expectedVersion: syncVersion, op: 'topic:update', payload: { id: sourceId, data: { parentId: targetId } } });
      setRoadmap(prev => prev ? {
        ...prev,
        topics: prev.topics.map(t => t.id === sourceId ? { ...t, ...j.topic } : t),
      } : prev);
      setOpen(o => ({ ...o, [targetId]: true }));
      updateSyncVersion(j.version ?? syncVersion);
      flash('Topic moved');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Move failed');
    }
  }

  // Poll only for remote collaboration changes. This effect must not restart on every version update.
  useEffect(() => {
    if (!roadmap) return;
    let alive = true;
    let inFlight = false;
    const intervalMs = Math.max(10_000, Number(process.env.NEXT_PUBLIC_COLLAB_BRANCH_SYNC_MS || process.env.NEXT_PUBLIC_COLLAB_SYNC_MS || 15_000));

    const tick = async () => {
      if (!alive || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        if (branchId && sharedRoadmapId) {
          const res = await fetch(`/api/collab/${sharedRoadmapId}/branches/${branchId}`, { cache: 'no-store' });
          if (!alive || !res.ok) return;
          const data = await res.json();
          const nextVersion = Number(data.branch.version ?? 0);
          if (nextVersion !== syncVersionRef.current) {
            const next = { ...data.roadmap.roadmap, version: nextVersion, topics: data.roadmap.topics };
            setRoadmap(prev => prev?.version === nextVersion ? prev : next);
            setRoadmaps(prev => prev.length === 1 && prev[0].version === nextVersion ? prev : [next]);
            setBranchName(prev => prev === data.branch.name ? prev : data.branch.name);
            setPermission(prev => prev === data.role ? prev : data.role);
            setSelected(value => value && next.topics.some((t: Topic) => t.id === value) ? value : next.topics[0]?.id ?? null);
            updateSyncVersion(nextVersion);
          }
          return;
        }

        await fetch(`/api/collab/${roadmap.id}/presence`, { method: 'POST' });
        const currentVersion = syncVersionRef.current;
        const [eventRes, presenceRes] = await Promise.all([
          fetch(`/api/collab/${roadmap.id}/events?since=${currentVersion}`, { cache: 'no-store' }),
          fetch(`/api/collab/${roadmap.id}/presence`, { cache: 'no-store' }),
        ]);
        if (!alive) return;

        if (permissionRef.current === 'owner') {
          const mr = await fetch(`/api/collab/${roadmap.id}/members`, { cache: 'no-store' });
          if (mr.ok) {
            const nextMembers = await mr.json();
            setMembers((prev: typeof nextMembers) => JSON.stringify(prev) === JSON.stringify(nextMembers) ? prev : nextMembers);
          }
        }
        if (presenceRes.ok) {
          const nextPeople = (await presenceRes.json()).people ?? [];
          setCollaborators(prev => JSON.stringify(prev) === JSON.stringify(nextPeople) ? prev : nextPeople);
        }
        if (eventRes.ok) {
          const data = await eventRes.json();
          const nextVersion = Number(data.version ?? currentVersion);
          if (nextVersion > syncVersionRef.current) {
            updateSyncVersion(nextVersion);
            await loadRef.current(roadmap.id);
          }
        }
      } catch {
        // Polling is best-effort; preserve current local state when the network is unavailable.
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const timer = window.setInterval(() => { void tick(); }, intervalMs);
    const onVisibility = () => { if (document.visibilityState === 'visible') void tick(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [roadmap?.id, sharedRoadmapId, branchId]);

  function expandAll() {
    setOpen(Object.fromEntries((roadmap?.topics ?? []).map(t => [t.id, true])));
  }

  function collapseAll() {
    setOpen({});
  }


  if (loading) return <Card className="p-8">Loading your data…</Card>;
  if (!roadmap) return (
    <Card className="p-10 text-center">
      <h2 className="text-xl font-semibold">Create your first roadmap</h2>
      <p className="mt-2 text-sm text-slate-500">All data is stored against your authenticated user ID.</p>
      <Button className="mt-5" onClick={createRoadmap}>Create roadmap</Button>
    </Card>
  );

  if (viewOnly) {
    return (
      <div className="space-y-4">
        {loading ? (
          <Card className="grid min-h-[620px] place-items-center p-8"><span className="text-sm text-slate-500">Loading roadmap…</span></Card>
        ) : roadmap ? (
          <Card className="overflow-hidden">
            <div className="border-b border-[hsl(var(--line))] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0"><h2 className="truncate text-lg font-semibold">{roadmap.title}</h2><p className="mt-1 line-clamp-2 text-xs text-slate-500">{roadmap.description || 'Shared community roadmap'}</p></div>
                <Badge>{calcProgress(roadmap.topics)}% complete</Badge>
              </div>
            </div>
            <div className="roadmap-canvas-shell roadmap-canonical-surface">
              {roadmap.topics.length ? (
                <RoadmapVisualCanvas roadmapId={roadmap.id} topics={roadmap.topics} editorState={roadmap.editorState} search="" selectedId={selected} locked showLockBadge={false} onSelect={(id) => { setSelected(id); }} />
              ) : <div className="grid min-h-[620px] place-items-center text-sm text-slate-500">This roadmap has no topics yet.</div>}
            </div>
          </Card>
        ) : <Card className="p-8 text-center text-sm text-slate-500">Unable to load roadmap.</Card>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {sharedRoadmapId && <Badge>{branchId ? `Branch: ${branchName}` : directGroup ? 'Team direct edit' : permission === 'topic_editor' ? 'Scoped collaborator' : permission}</Badge>}
          <select value={roadmap.id} onChange={e => load(e.target.value)} className="rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-sm">
            {roadmaps.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          {!sharedRoadmapId && <Button variant="outline" onClick={createRoadmap}><Plus size={15} /> New roadmap</Button>}
          {sharedRoadmapId && !branchId && permission === 'contributor' && <Button variant="outline" onClick={() => location.href=`/collaborate/${sharedRoadmapId}`}>Open collaboration</Button>}
          {branchId && <Button onClick={commitAndPush}><Share2 size={15}/> Share changes</Button>}
          <SyncRoadmapButton onSync={syncLatest} compact />
          {canEditRoadmap && <Button variant="outline" onClick={() => addTopic(null)}><Plus size={15} /> Top-level topic</Button>}
          {canEditRoadmap && <Button variant="outline" onClick={saveRoadmap}><Save size={15} /> Save</Button>}
          {notice && <span className="text-sm text-emerald-600">{notice}</span>}
          {sharedRoadmapId && permission === 'contributor' && !branchId && !directGroup && <Badge>Direct collaboration</Badge>}
          {sharedRoadmapId && collaborators.length > 0 && <span className="text-xs text-slate-500">{collaborators.length} collaborator{collaborators.length === 1 ? '' : 's'} online</span>}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_430px]">
        <Card className="min-h-[720px] overflow-hidden">
          <div className="border-b border-[hsl(var(--line))] p-5">
            <div className="flex items-center gap-3">
              <input disabled={!canEditRoadmap} value={roadmap.title} onChange={e => setRoadmap(prev => prev ? { ...prev, title: e.target.value } : prev)} className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none" />
              <Badge>{calcProgress(roadmap.topics)}%</Badge>
            </div>
            <textarea disabled={!canEditRoadmap} value={roadmap.description} onChange={e => setRoadmap(prev => prev ? { ...prev, description: e.target.value } : prev)} placeholder="Roadmap description" className="mt-2 w-full resize-none bg-transparent text-sm text-slate-500 outline-none" />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select disabled={!canEditRoadmap} value={roadmap.privacy} onChange={e => setRoadmap(prev => prev ? { ...prev, privacy: e.target.value as Roadmap['privacy'] } : prev)} className="rounded-lg border border-[hsl(var(--line))] bg-transparent px-2 py-1 text-xs">
                <option value="private">Private</option>
                <option value="link">Anyone with link</option>
                <option value="public">Public</option>
              </select>
              {roadmap.privacy !== 'private' && (
                <a className="text-xs text-indigo-600" href={`/share/${roadmap.shareSlug}`} target="_blank">
                  Open link <ExternalLink size={12} className="inline" />
                </a>
              )}
              <button className="text-xs text-slate-500" onClick={() => navigator.clipboard?.writeText(`${location.origin}/share/${roadmap.shareSlug}`)}>Copy link</button>
            </div>
          </div>

          <div className="roadmap-canvas-shell roadmap-canonical-surface">
            <div className="roadmap-canvas-toolbar">
              <div className="roadmap-search">
                <Search size={16} />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search topics, tags, descriptions…" />
                {searchTerm && <button type="button" onClick={() => setSearchTerm('')}>Clear</button>}
              </div>
              <div className="roadmap-canvas-toolbar-actions">
                <button type="button" onClick={expandAll} title="Expand all"><Maximize2 size={15}/> Expand</button>
                <button type="button" onClick={collapseAll} title="Collapse all"><Minimize2 size={15}/> Collapse</button>
                <span className="roadmap-canvas-toolbar-note"><PanelRight size={14}/> Select a node for details</span>
              </div>
            </div>
            {roots.length ? (
              <RoadmapVisualCanvas
                roadmapId={roadmap.id}
                topics={roadmap.topics}
                editorState={roadmap.editorState}
                search={searchTerm}
                selectedId={selected}
                locked
                showLockBadge={false}
                onSelect={(id) => { setSelected(id); }}
              />
            ) : (
              <div className="grid min-h-[620px] place-items-center p-8 text-center">
                <div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30"><Plus size={24}/></div><p className="mt-4 font-semibold">No topics yet</p><p className="mt-1 text-sm text-slate-500">Create your first top-level topic and build the tree visually.</p>{canEditRoadmap && <Button className="mt-4" onClick={() => addTopic(null)}><Plus size={15}/> Add topic</Button>}</div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          {current ? (
            <>
              <div className="rounded-2xl border border-[hsl(var(--line))] bg-slate-50/70 p-3 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={progressSaving} onClick={() => void setPersonalStatus('learning')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${personalProgress[current.id]?.status === 'learning' || !personalProgress[current.id] ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'border-[hsl(var(--line))]'}`}>Learning</button>
                  <button type="button" disabled={progressSaving} onClick={() => void setPersonalStatus('done')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${personalProgress[current.id]?.status === 'done' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-[hsl(var(--line))]'}`}>✓ Done</button>
                  <button type="button" disabled={progressSaving} onClick={() => void setPersonalStatus('skipped')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${personalProgress[current.id]?.status === 'skipped' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 'border-[hsl(var(--line))]'}`}>× Skip</button>
                  {progressSaving && <span className="text-[11px] text-slate-500">Saving…</span>}
                </div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{current.title}</h2>
                  <p className="text-xs text-slate-500">Topic ID: <span className="font-mono">{current.id}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{personalProgress[current.id]?.status === 'done' ? 'Done' : personalProgress[current.id]?.status === 'skipped' ? 'Skipped' : 'Learning'}</Badge>
                  <Button variant="ghost" disabled={!canEdit} onClick={deleteTopic}><Trash2 size={17} className="text-red-500" /></Button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 rounded-2xl border border-[hsl(var(--line))] p-3 text-xs text-slate-600 dark:text-slate-300">
                <div><span className="font-semibold">Description:</span> {current.description || 'No description'}</div>
                <div><span className="font-semibold">Notes:</span> {current.notes || 'No notes'}</div>
                <div><span className="font-semibold">Tags:</span> {current.tags.length ? current.tags.join(', ') : 'No tags'}</div>
                <div><span className="font-semibold">Due:</span> {current.dueDate ? new Date(current.dueDate).toLocaleDateString() : 'No due date'}</div>
                <div><span className="font-semibold">Resources:</span> {current.resources?.length ?? 0}</div>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block text-sm font-medium">
                  Title
                  <input disabled={!canEdit} value={current.title} onChange={e => setRoadmap(prev => prev ? { ...prev, topics: prev.topics.map(t => t.id === current.id ? { ...t, title: e.target.value } : t) } : prev)} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2" />
                </label>

                <label className="block text-sm font-medium">
                  Description
                  <textarea disabled={!canEdit} value={current.description} onChange={e => setRoadmap(prev => prev ? { ...prev, topics: prev.topics.map(t => t.id === current.id ? { ...t, description: e.target.value } : t) } : prev)} className="mt-1 h-24 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent p-3" />
                </label>

                <label className="block text-sm font-medium">
                  Notes / Markdown
                  <textarea disabled={!canEdit} value={current.notes} onChange={e => setRoadmap(prev => prev ? { ...prev, topics: prev.topics.map(t => t.id === current.id ? { ...t, notes: e.target.value } : t) } : prev)} className="mt-1 h-40 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent p-3" />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium">
                    Status
                    <select disabled={!canEdit} value={current.status} onChange={e => setRoadmap(prev => prev ? { ...prev, topics: prev.topics.map(t => t.id === current.id ? { ...t, status: e.target.value as Topic['status'], progress: e.target.value === 'completed' ? 100 : t.progress } : t) } : prev)} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2">
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>

                  <label className="text-sm font-medium">
                    Progress
                    <input disabled={!canEdit} type="number" min="0" max="100" value={current.progress} onChange={e => setRoadmap(prev => prev ? { ...prev, topics: prev.topics.map(t => t.id === current.id ? { ...t, progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : t) } : prev)} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2" />
                  </label>
                </div>

                <label className="block text-sm font-medium">
                  Tags
                  <input disabled={!canEdit} value={current.tags.join(', ')} onChange={e => setRoadmap(prev => prev ? { ...prev, topics: prev.topics.map(t => t.id === current.id ? { ...t, tags: e.target.value.split(',').map(x => x.trim()).filter(Boolean) } : t) } : prev)} placeholder="arrays, dsa, interview" className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2" />
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button disabled={!canEdit} onClick={saveTopic}><Save size={15} /> Save topic</Button>
                  <Button variant="outline" disabled={!canEdit} onClick={() => addTopic(current.id)}><Plus size={15} /> Add child</Button>
                </div>
              </div>

              <div className="border-t border-[hsl(var(--line))] pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Resources</h3>
                  <Button variant="outline" disabled={!canEdit} onClick={addResource}><Plus size={14} /> Add</Button>
                </div>

                {current && !sharedRoadmapId && <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20"><div className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">Share this layer</div><p className="mt-1 text-[11px] text-indigo-700/80 dark:text-indigo-200/80">Shares only this topic and every child below it.</p><div className="mt-2 flex flex-wrap items-center gap-2"><Button variant="outline" onClick={async()=>{const r=await fetch(`/api/topics/${current.id}/share-link`,{method:'POST'});const j=await r.json().catch(()=>({}));if(!r.ok)return flash(j?.error||'Could not create share link');const href=`${location.origin}${j.path}`;try{await navigator.clipboard.writeText(href)}catch{};setRoadmap(prev=>prev?{...prev,topics:prev.topics.map(t=>t.id===current.id?{...t,shareToken:j.topic?.shareToken}:t)}:prev);flash('Layer link copied');}}><Share2 size={13}/> {current.shareToken?'Copy layer link':'Create layer link'}</Button>{current.shareToken && <><a className="text-xs text-indigo-600 underline" href={`/share/topic/${current.shareToken}`} target="_blank" rel="noreferrer">Open</a><button className="text-xs text-red-600" onClick={async()=>{const r=await fetch(`/api/topics/${current.id}/share-link`,{method:'DELETE'});if(r.ok){setRoadmap(prev=>prev?{...prev,topics:prev.topics.map(t=>t.id===current.id?{...t,shareToken:null}:t)}:prev);flash('Layer link revoked')}}}>Revoke</button></>}</div></div>}
                {(current?.resources?.length ?? 0) === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No resources yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {(current?.resources ?? []).map(r => (
                      <div key={r.id} className="rounded-xl border border-[hsl(var(--line))] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <a href={r.url} target="_blank" className="font-medium hover:underline">{r.title}</a>
                            <div className="mt-1 text-xs text-slate-500">{r.type} · {r.completed ? 'Completed' : 'Not completed'}{r.favorite ? ' · Favorite' : ''}</div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button disabled={!canEdit} title="Complete" onClick={() => toggleResource(r, 'completed')} className="rounded px-2 py-1 text-xs">{r.completed ? 'Undo' : 'Done'}</button>
                            <button disabled={!canEdit} title="Favorite" onClick={() => toggleResource(r, 'favorite')} className="rounded px-2 py-1 text-xs">{r.favorite ? '★' : '☆'}</button>
                            <button disabled={!canEdit} title="Edit" onClick={() => editResource(r)} className="rounded px-2 py-1 text-xs">Edit</button>
                            <button disabled={!canEdit} title="Delete" onClick={() => deleteResource(r)} className="rounded px-2 py-1 text-xs text-red-500">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!sharedRoadmapId && <div className="border-t border-[hsl(var(--line))] pt-4">
                <h3 className="font-semibold"><Share2 size={16} className="mr-1 inline" /> Share with a user</h3>
                <p className="mt-1 text-xs text-slate-500">The receiver should give you their account User ID. You enter it here; they receive a database-backed notification.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input value={shareId} onChange={e => setShareId(e.target.value)} placeholder="Receiver User ID" className="min-w-0 flex-1 rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-sm" />
                  <select value={shareRole} onChange={e => setShareRole(e.target.value as 'contributor'|'viewer')} className="rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-sm"><option value="contributor">Collaborator — direct edit</option><option value="viewer">View only</option></select>
                  <div className="flex gap-2">
                    <Button onClick={() => sendShare('topic')} disabled={!current}>Layer + children</Button>
                    <Button onClick={() => sendShare('roadmap')}>Whole roadmap</Button>
                  </div>
                </div>
                {(members.roadmapMembers?.length || members.topicMembers?.length) ? <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-900">
                  <p className="font-semibold">Access</p>
                  <div className="mt-2 space-y-1">
                    {(members.roadmapMembers||[]).map((m:any)=><div key={`r-${m.id}`} className="flex items-center justify-between gap-2"><span className="font-mono">{m.userId}</span><span>{m.role}</span><button className="text-red-500" onClick={async()=>{await fetch(`/api/collab/${roadmap.id}/members`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope:'roadmap',userId:m.userId})});const mr=await fetch(`/api/collab/${roadmap.id}/members`);if(mr.ok)setMembers(await mr.json())}}>Revoke</button></div>)}
                    {(members.topicMembers||[]).slice(0,20).map((m:any)=><div key={`t-${m.id}`} className="flex items-center justify-between gap-2"><span><span className="font-mono">{m.userId}</span> · {m.topic?.title}</span><span>{m.role} <button className="ml-2 text-red-500" onClick={async()=>{await fetch(`/api/collab/${roadmap.id}/members`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope:'topic',userId:m.userId,topicId:m.topicId})});const mr=await fetch(`/api/collab/${roadmap.id}/members`);if(mr.ok)setMembers(await mr.json())}}>Revoke</button></span></div>)}
                  </div>
                </div> : null}
              </div>}
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a topic.</p>
          )}
        </Card>
      </div>

      <div className="flex gap-3 text-xs text-slate-500">
        <button onClick={() => location.href = `/api/export?roadmapId=${roadmap.id}&format=json`} className="underline">Export JSON</button>
        <button onClick={() => location.href = `/api/export?roadmapId=${roadmap.id}&format=markdown`} className="underline">Export Markdown</button>
        <span>{branchId ? 'Changes are saved directly to the shared roadmap for collaborators.' : 'Drag a topic onto another topic to make it a child.'}</span>
      </div>
    </div>
  );
}
