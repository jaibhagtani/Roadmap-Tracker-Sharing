'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Save, Share2, GripVertical, ExternalLink } from 'lucide-react';
import { Button, Card, Badge } from './ui';

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
  resources: Resource[];
};

type Roadmap = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  privacy: 'private' | 'link' | 'public';
  shareSlug: string;
  topics: Topic[];
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

export function RoadmapTree() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [shareId, setShareId] = useState('');
  const [notice, setNotice] = useState('');

  async function call(url: string, method: string, body?: any) {
    const r = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function load(preferred?: string) {
    setLoading(true);
    try {
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
      setSelected(value => value && data.roadmap.topics.some((t: Topic) => t.id === value)
        ? value
        : data.roadmap.topics[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const roots = useMemo(() => (roadmap ? treeify(roadmap.topics) : []), [roadmap]);
  const current = roadmap?.topics.find(t => t.id === selected) ?? null;

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 1800);
  };

  async function createRoadmap() {
    const name = prompt('Roadmap name');
    if (!name?.trim()) return;
    const j = await call('/api/roadmaps', 'POST', { title: name.trim() });
    await load(j.roadmap.id);
  }

  async function addTopic(parentId: string | null) {
    if (!roadmap) return;
    const name = prompt(parentId ? 'Child topic name' : 'Top-level topic name');
    if (!name?.trim()) return;

    const j = await call('/api/topics', 'POST', {
      roadmapId: roadmap.id,
      parentId,
      title: name.trim(),
    });

    setRoadmap({ ...roadmap, topics: [...roadmap.topics, j.topic] });
    setSelected(j.topic.id);
    if (parentId) setOpen(o => ({ ...o, [parentId]: true }));
  }

  async function saveRoadmap() {
    if (!roadmap) return;
    const j = await call(`/api/roadmaps/${roadmap.id}`, 'PATCH', {
      title: roadmap.title,
      description: roadmap.description,
      privacy: roadmap.privacy,
    });
    setRoadmap({ ...roadmap, ...j.roadmap });
    flash('Roadmap saved');
  }

  async function saveTopic() {
    if (!current || !roadmap) return;
    const j = await call(`/api/topics/${current.id}`, 'PATCH', {
      title: current.title,
      description: current.description,
      notes: current.notes,
      status: current.status,
      progress: current.progress,
      priority: current.priority,
      tags: current.tags,
      dueDate: current.dueDate,
    });

    setRoadmap({
      ...roadmap,
      topics: roadmap.topics.map(t => t.id === current.id ? { ...t, ...j.topic } : t),
    });
    flash('Topic saved');
  }

  async function deleteTopic() {
    if (!current || !roadmap || !confirm(`Delete “${current.title}” and everything under it?`)) return;
    await call(`/api/topics/${current.id}`, 'DELETE');
    await load(roadmap.id);
    setSelected(null);
    flash('Topic deleted');
  }

  async function addResource() {
    if (!current || !roadmap) return;
    const title = prompt('Resource title');
    if (!title?.trim()) return;
    const url = prompt('Resource URL');
    if (!url?.trim()) return;

    const j = await call('/api/resources', 'POST', {
      topicId: current.id,
      title: title.trim(),
      url: url.trim(),
    });

    setRoadmap({
      ...roadmap,
      topics: roadmap.topics.map(t => t.id === current.id ? { ...t, resources: [...t.resources, j.resource] } : t),
    });
  }

  async function editResource(r: Resource) {
    const title = prompt('Resource title', r.title);
    if (title === null) return;
    const url = prompt('Resource URL', r.url);
    if (url === null) return;

    const j = await call(`/api/resources/${r.id}`, 'PATCH', {
      title,
      url,
      completed: r.completed,
      favorite: r.favorite,
      notes: r.notes,
    });

    setRoadmap({
      ...roadmap,
      topics: roadmap.topics.map(t => t.id === current?.id ? {
        ...t,
        resources: t.resources.map(x => x.id === r.id ? { ...x, ...j.resource } : x),
      } : t),
    });
  }

  async function toggleResource(r: Resource, key: 'completed' | 'favorite') {
    if (!current || !roadmap) return;
    const j = await call(`/api/resources/${r.id}`, 'PATCH', { [key]: !r[key] });

    setRoadmap({
      ...roadmap,
      topics: roadmap.topics.map(t => t.id === current.id ? {
        ...t,
        resources: t.resources.map(x => x.id === r.id ? { ...x, ...j.resource } : x),
      } : t),
    });
  }

  async function deleteResource(r: Resource) {
    if (!current || !roadmap || !confirm('Delete this resource?')) return;
    await call(`/api/resources/${r.id}`, 'DELETE');

    setRoadmap({
      ...roadmap,
      topics: roadmap.topics.map(t => t.id === current.id ? {
        ...t,
        resources: t.resources.filter(x => x.id !== r.id),
      } : t),
    });
  }

  async function sendShare(scopeType: 'roadmap' | 'topic') {
    if (!roadmap || !shareId.trim()) return;

    await call('/api/share-requests', 'POST', {
      scopeType,
      roadmapId: roadmap.id,
      rootTopicId: scopeType === 'topic' ? current?.id : null,
      receiverId: shareId.trim(),
      message: scopeType === 'topic'
        ? `You have been invited to view “${current?.title}” and all of its children.`
        : `You have been invited to view “${roadmap.title}”.`,
    });

    setShareId('');
    flash(scopeType === 'topic' ? 'Layer share request sent' : 'Roadmap share request sent');
  }

  async function dropTopic(targetId: string, sourceId: string) {
    if (!roadmap || targetId === sourceId) return;
    const target = roadmap.topics.find(t => t.id === targetId);
    if (target?.parentId === sourceId) return;

    try {
      const j = await call(`/api/topics/${sourceId}`, 'PATCH', { parentId: targetId });
      setRoadmap({
        ...roadmap,
        topics: roadmap.topics.map(t => t.id === sourceId ? { ...t, ...j.topic } : t),
      });
      setOpen(o => ({ ...o, [targetId]: true }));
      flash('Topic moved');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Move failed');
    }
  }

  function Row({ n, depth = 0 }: { n: Node; depth?: number }) {
    const has = n.children.length > 0;

    return (
      <div
        draggable
        onDragStart={e => e.dataTransfer.setData('text/topic-id', n.id)}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const id = e.dataTransfer.getData('text/topic-id');
          if (id) dropTopic(n.id, id);
        }}
      >
        <div
          className={`group flex items-center gap-2 rounded-xl px-2 py-2 ${selected === n.id ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          style={{ paddingLeft: depth * 24 + 8 }}
        >
          <GripVertical size={14} className="cursor-grab text-slate-300" />
          {has ? (
            <button aria-label="toggle" onClick={() => setOpen(o => ({ ...o, [n.id]: !o[n.id] }))}>
              {open[n.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : <span className="w-4" />}
          <button className="flex-1 text-left font-medium" onClick={() => setSelected(n.id)}>{n.title}</button>
          <span className="hidden text-xs text-slate-400 md:inline">{n.progress}%</span>
        </div>
        {has && open[n.id] && n.children.map(c => <Row key={c.id} n={c} depth={depth + 1} />)}
      </div>
    );
  }

  if (loading) return <Card className="p-8">Loading your data…</Card>;
  if (!roadmap) return (
    <Card className="p-10 text-center">
      <h2 className="text-xl font-semibold">Create your first roadmap</h2>
      <p className="mt-2 text-sm text-slate-500">All data is stored against your authenticated user ID.</p>
      <Button className="mt-5" onClick={createRoadmap}>Create roadmap</Button>
    </Card>
  );

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={roadmap.id} onChange={e => load(e.target.value)} className="rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-sm">
            {roadmaps.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <Button variant="outline" onClick={createRoadmap}><Plus size={15} /> New roadmap</Button>
          <Button variant="outline" onClick={() => addTopic(null)}><Plus size={15} /> Top-level topic</Button>
          <Button variant="outline" onClick={saveRoadmap}><Save size={15} /> Save</Button>
          {notice && <span className="text-sm text-emerald-600">{notice}</span>}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_430px]">
        <Card className="min-h-[720px] overflow-hidden">
          <div className="border-b border-[hsl(var(--line))] p-5">
            <div className="flex items-center gap-3">
              <input value={roadmap.title} onChange={e => setRoadmap({ ...roadmap, title: e.target.value })} className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none" />
              <Badge>{calcProgress(roadmap.topics)}%</Badge>
            </div>
            <textarea value={roadmap.description} onChange={e => setRoadmap({ ...roadmap, description: e.target.value })} placeholder="Roadmap description" className="mt-2 w-full resize-none bg-transparent text-sm text-slate-500 outline-none" />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select value={roadmap.privacy} onChange={e => setRoadmap({ ...roadmap, privacy: e.target.value as Roadmap['privacy'] })} className="rounded-lg border border-[hsl(var(--line))] bg-transparent px-2 py-1 text-xs">
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

          <div className="p-4">
            {roots.length ? roots.map(n => <Row key={n.id} n={n} />) : (
              <p className="p-8 text-center text-sm text-slate-500">No topics yet. Add your first top-level topic.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          {current ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{current.title}</h2>
                  <p className="text-xs text-slate-500">Topic ID: <span className="font-mono">{current.id}</span></p>
                </div>
                <Button variant="ghost" onClick={deleteTopic}><Trash2 size={17} className="text-red-500" /></Button>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block text-sm font-medium">
                  Title
                  <input value={current.title} onChange={e => setRoadmap({ ...roadmap, topics: roadmap.topics.map(t => t.id === current.id ? { ...t, title: e.target.value } : t) })} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2" />
                </label>

                <label className="block text-sm font-medium">
                  Description
                  <textarea value={current.description} onChange={e => setRoadmap({ ...roadmap, topics: roadmap.topics.map(t => t.id === current.id ? { ...t, description: e.target.value } : t) })} className="mt-1 h-24 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent p-3" />
                </label>

                <label className="block text-sm font-medium">
                  Notes / Markdown
                  <textarea value={current.notes} onChange={e => setRoadmap({ ...roadmap, topics: roadmap.topics.map(t => t.id === current.id ? { ...t, notes: e.target.value } : t) })} className="mt-1 h-40 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent p-3" />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium">
                    Status
                    <select value={current.status} onChange={e => setRoadmap({ ...roadmap, topics: roadmap.topics.map(t => t.id === current.id ? { ...t, status: e.target.value as Topic['status'], progress: e.target.value === 'completed' ? 100 : t.progress } : t) })} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2">
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>

                  <label className="text-sm font-medium">
                    Progress
                    <input type="number" min="0" max="100" value={current.progress} onChange={e => setRoadmap({ ...roadmap, topics: roadmap.topics.map(t => t.id === current.id ? { ...t, progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : t) })} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2" />
                  </label>
                </div>

                <label className="block text-sm font-medium">
                  Tags
                  <input value={current.tags.join(', ')} onChange={e => setRoadmap({ ...roadmap, topics: roadmap.topics.map(t => t.id === current.id ? { ...t, tags: e.target.value.split(',').map(x => x.trim()).filter(Boolean) } : t) })} placeholder="arrays, dsa, interview" className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2" />
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={saveTopic}><Save size={15} /> Save topic</Button>
                  <Button variant="outline" onClick={() => addTopic(current.id)}><Plus size={15} /> Add child</Button>
                </div>
              </div>

              <div className="border-t border-[hsl(var(--line))] pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Resources</h3>
                  <Button variant="outline" onClick={addResource}><Plus size={14} /> Add</Button>
                </div>

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
                            <button title="Complete" onClick={() => toggleResource(r, 'completed')} className="rounded px-2 py-1 text-xs">{r.completed ? 'Undo' : 'Done'}</button>
                            <button title="Favorite" onClick={() => toggleResource(r, 'favorite')} className="rounded px-2 py-1 text-xs">{r.favorite ? '★' : '☆'}</button>
                            <button title="Edit" onClick={() => editResource(r)} className="rounded px-2 py-1 text-xs">Edit</button>
                            <button title="Delete" onClick={() => deleteResource(r)} className="rounded px-2 py-1 text-xs text-red-500">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-[hsl(var(--line))] pt-4">
                <h3 className="font-semibold"><Share2 size={16} className="mr-1 inline" /> Share with a user</h3>
                <p className="mt-1 text-xs text-slate-500">The receiver should give you their account User ID. You enter it here; they receive a database-backed notification.</p>
                <div className="mt-2 flex gap-2">
                  <input value={shareId} onChange={e => setShareId(e.target.value)} placeholder="Receiver User ID" className="min-w-0 flex-1 rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <Button onClick={() => sendShare('topic')} disabled={!current}>Layer + children</Button>
                    <Button onClick={() => sendShare('roadmap')}>Whole roadmap</Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a topic.</p>
          )}
        </Card>
      </div>

      <div className="flex gap-3 text-xs text-slate-500">
        <button onClick={() => location.href = `/api/export?roadmapId=${roadmap.id}&format=json`} className="underline">Export JSON</button>
        <button onClick={() => location.href = `/api/export?roadmapId=${roadmap.id}&format=markdown`} className="underline">Export Markdown</button>
        <span>Drag a topic onto another topic to make it a child.</span>
      </div>
    </div>
  );
}
