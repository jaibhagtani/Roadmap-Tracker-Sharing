'use client';

import { SyncRoadmapButton } from './sync-roadmap-button';
import { ShareRoadmapDialog } from './share-roadmap-dialog';
import { GroupChat } from './group-chat';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ReactFlowProvider, type Edge } from 'reactflow';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import 'reactflow/dist/style.css';
import {
  ArrowRight, Check, CircleDot, Copy, ExternalLink, FileText, GripVertical, Link2, List, MessageCircle, MoreHorizontal, Network, Plus, Redo2, Save, Search, Share2,
  Settings2, Trash2, Type, Undo2, X, Maximize2, Lock, Unlock, SearchX, Crosshair, AlignLeft, Layers, LockKeyhole, UnlockKeyhole, RotateCcw,
} from 'lucide-react';
import { Button, Badge, Card } from './ui';
import { StudioCanvas, type StudioCanvasHandle } from './studio-canvas';

type Resource = { id: string; title: string; url: string; type: string; notes: string; completed: boolean; favorite: boolean };
type Topic = {
  id: string; roadmapId: string; parentId: string | null; title: string; description: string; notes: string;
  status: 'not_started' | 'in_progress' | 'completed'; progress: number; priority: number; position: number;
  tags: string[]; dueDate: string | null; shareToken?: string | null; resources: Resource[];
};
type EditorElement = {
  id: string; kind: ElementKind; text: string; body?: string; url?: string; position: { x:number; y:number };
  width?: number; height?: number; style?: 'default'|'highlight'|'muted'; color?: string;
  fontSize?: number; fontWeight?: number; textAlign?: 'left'|'center'|'right'; padding?: number; borderRadius?: number;
  borderWidth?: number; opacity?: number; shadow?: 'none'|'soft'|'strong'; zIndex?: number; locked?: boolean;
};
type ElementKind = 'title'|'topic'|'subtopic'|'legend';
type EditorState = {
  elements: EditorElement[];
  topicPositions: Record<string,{x:number;y:number}>;
  connections?: Edge[];
  viewport?: { x:number; y:number; zoom:number };
  topicColors?: Record<string,string>;
};
type Roadmap = {
  id: string; ownerId: string; title: string; description: string; privacy: 'private'|'link'|'public'; shareSlug: string;
  version: number; updatedAt?: string; editorState?: EditorState; topics: Topic[];
};
const palette: Array<{kind: ElementKind; label:string; icon:any; description:string}> = [
  { kind:'title', label:'Title', icon:Type, description:'Roadmap heading' },
  { kind:'topic', label:'Topic', icon:CircleDot, description:'Primary learning node' },
  { kind:'subtopic', label:'Sub Topic', icon:Network, description:'Child of the selected topic' },
  { kind:'legend', label:'Legend', icon:List, description:'Explain colors and rules' },
];

const REMOVED_ELEMENT_KINDS = new Set(['paragraph','button','links-group','h-line','v-line','section']);

const initialEditorState = (): EditorState => ({ elements: [], topicPositions: {}, connections: [], viewport: { x: 0, y: 0, zoom: 1 }, topicColors: {} });

const COLOR_PRESETS = [
  { id:'indigo', label:'Indigo', bg:'#E8EEFF', border:'#6675F2', text:'#1E2752', dot:'#5B67D8' },
  { id:'violet', label:'Violet', bg:'#EEE9FF', border:'#8A63D2', text:'#38245F', dot:'#7C3AED' },
  { id:'sky', label:'Sky', bg:'#E3F3FF', border:'#4E9BD6', text:'#183B56', dot:'#2F7EC5' },
  { id:'mint', label:'Mint', bg:'#E4F7EE', border:'#4AAE7A', text:'#173F2C', dot:'#2E8B57' },
  { id:'peach', label:'Peach', bg:'#FFF0E3', border:'#E39A64', text:'#5A2E19', dot:'#D97745' },
  { id:'rose', label:'Rose', bg:'#FCE8F1', border:'#D979A4', text:'#5B243B', dot:'#C85A8C' },
  { id:'slate', label:'Slate', bg:'#EEF2F6', border:'#718096', text:'#26323F', dot:'#5B6775' },
  { id:'gold', label:'Gold', bg:'#FFF7D6', border:'#C9A227', text:'#4E3F06', dot:'#B78A00' },
] as const;

function colorPreset(id?: string) {
  const preset = COLOR_PRESETS.find(c => c.id === id);
  if (preset) return preset;
  if (id && /^#[0-9a-f]{6}$/i.test(id)) return { id, label:'Custom', bg:id + '1A', border:id, text:'#1F2937', dot:id };
  return COLOR_PRESETS[0];
}
function defaultTopicColor(topic: Topic, topics: Topic[]) {
  let depth = 0; let current: Topic | undefined = topic;
  while (current?.parentId) { depth += 1; current = topics.find(t => t.id === current?.parentId); if (depth > 20) break; }
  if (depth === 0) return 'gold';
  if (depth === 1) return 'gold';
  if (depth === 2) return 'peach';
  if (depth === 3) return 'peach';
  return 'slate';
}

function applyDefaults(state: EditorState, topics: Topic[]): EditorState {
  const next: EditorState = {
    elements: (state.elements || []).filter((e:any) => !REMOVED_ELEMENT_KINDS.has(e?.kind)),
    topicPositions: { ...(state.topicPositions || {}) },
    connections: [...(state.connections || [])].filter((edge:any) => !((state.elements || []).find((e:any)=>e.id===edge.source)?.kind ? REMOVED_ELEMENT_KINDS.has(String((state.elements || []).find((e:any)=>e.id===edge.source)?.kind)) : false) && !((state.elements || []).find((e:any)=>e.id===edge.target)?.kind ? REMOVED_ELEMENT_KINDS.has(String((state.elements || []).find((e:any)=>e.id===edge.target)?.kind)) : false)),
    viewport: state.viewport || { x: 0, y: 0, zoom: 1 },
    topicColors: { ...(state.topicColors || {}) },
  };
  topics.forEach((t) => { if (!next.topicColors![t.id]) next.topicColors![t.id] = defaultTopicColor(t, topics); });
  const children = new Map<string|null, Topic[]>();
  topics.forEach((t) => children.set(t.parentId, [...(children.get(t.parentId) || []), t]));
  children.forEach((arr) => arr.sort((a,b) => a.position-b.position));
  const walk = (items: Topic[], x:number, startY:number) => {
    let cursor = startY;
    items.forEach((t) => {
      if (!next.topicPositions[t.id]) next.topicPositions[t.id] = { x, y: cursor };
      const kids = children.get(t.id) || [];
      if (kids.length) walk(kids, x + 340, next.topicPositions[t.id].y - ((kids.length - 1) * 48));
      cursor += Math.max(145, kids.length * 96 + 52);
    });
  };
  walk(children.get(null) || [], 620, 120);
  return next;
}

function RoadmapHeader({roadmap,roadmapList,dirty,saving,historyCount,futureCount,onLoad,onCreate,onSync,onCommit,onSave,onUndo,onRedo,onToggleChat,inspector,chatOpen,readOnly}:{
  roadmap:Roadmap; roadmapList:Array<{id:string;title:string}>; dirty:boolean; saving:boolean; historyCount:number; futureCount:number;
  onLoad:(id:string)=>void; onCreate:()=>void; onSync:()=>Promise<void>; onCommit:(patch:Partial<Pick<Roadmap,'title'|'description'|'privacy'>>)=>void; onSave:(patch?:Partial<Pick<Roadmap,'title'|'description'|'privacy'>>)=>void;
  onUndo:()=>void; onRedo:()=>void; onToggleChat:()=>void; inspector:boolean; chatOpen:boolean; readOnly:boolean;
}){
  const [title,setTitle]=useState(roadmap.title);
  const [description,setDescription]=useState(roadmap.description);
  useEffect(()=>{setTitle(roadmap.title);setDescription(roadmap.description)},[roadmap.id]);
  const commit=()=>onCommit({title,description});
  return <div className="studio-header">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <select value={roadmap.id} onChange={e=>onLoad(e.target.value)} className="max-w-56 rounded-lg border border-[hsl(var(--line))] bg-transparent px-2 py-1.5 text-[11px] font-semibold">{roadmapList.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select>
        <input disabled={readOnly} value={title} onChange={e=>setTitle(e.target.value)} onBlur={commit} className="studio-title-input" aria-label="Roadmap title"/>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{dirty?'Unsaved':'Saved'}</span>
      </div>
      <input disabled={readOnly} value={description} onChange={e=>setDescription(e.target.value)} onBlur={commit} placeholder="Add a roadmap description" className="studio-description-input"/>
    </div>
    <div className="flex flex-wrap items-center gap-1.5">
      <button className="studio-tool" title="Undo" disabled={readOnly || !historyCount} onClick={onUndo}><Undo2 size={16}/></button>
      <button className="studio-tool" title="Redo" disabled={readOnly || !futureCount} onClick={onRedo}><Redo2 size={16}/></button>
      <button className={`studio-tool ${chatOpen ? 'active' : ''}`} onClick={onToggleChat} title={chatOpen ? 'Close roadmap chat' : 'Open roadmap chat'}><MessageCircle size={16}/></button>
      {!readOnly && <ShareRoadmapDialog roadmapId={roadmap.id} shareSlug={roadmap.shareSlug} privacy={roadmap.privacy} onPublic={()=>onCommit({privacy:'public'})} />}
      <SyncRoadmapButton onSync={onSync} compact />
      {!readOnly && <Button variant="outline" onClick={onCreate}><Plus size={15}/> New</Button>}
      {!readOnly && <Button onClick={()=>onSave({title,description})} disabled={saving || !dirty}>{saving?<span className="studio-spinner"/>:<Save size={15}/>} {saving?'Saving…':'Save'}</Button>}
    </div>
  </div>;
}

function StudioInner({ initialRoadmapId }: { initialRoadmapId?: string } = {}) {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | undefined>(() => {
    if (initialRoadmapId) return initialRoadmapId;
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('roadmapId') || undefined;
    return undefined;
  });
  const [state, setState] = useState<EditorState>(initialEditorState());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [inspector, setInspector] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState<EditorState[]>([]);
  const [future, setFuture] = useState<EditorState[]>([]);
  const [lastActivityAt, setLastActivityAt] = useState<string | null>(null);
  const [accessRole, setAccessRole] = useState<'owner'|'editor'|'contributor'|'viewer'>('owner');
  const readOnly = accessRole === 'viewer';
  const autosaveTimer = useRef<number | null>(null);
  const activityPendingRef = useRef(false);
  const activityTimerRef = useRef<number | null>(null);
  const keyboardActionsRef = useRef<{persist:()=>void;undo:()=>void;redo:()=>void;deleteSelected:()=>void}>({persist:()=>{},undo:()=>{},redo:()=>{},deleteSelected:()=>{}});
  const stateRef = useRef(state);
  const roadmapRef = useRef<Roadmap | null>(roadmap);
  const canvasRef = useRef<StudioCanvasHandle | null>(null);
  const [canvasLocked, setCanvasLocked] = useState(false);
  const [focusRequest, setFocusRequest] = useState<string | null>(null);
  const roadmapsQuery = useGetJsonQuery({ url: '/api/roadmaps', tag: 'roadmaps' });
  const roadmapList = (((roadmapsQuery.data as any)?.roadmaps || []) as any[]).map((r:any) => ({id:r.id,title:r.title}));
  const requestedRoadmapId = activeRoadmapId || roadmapList[0]?.id;
  const roadmapQuery = useGetJsonQuery(
    { url: requestedRoadmapId ? `/api/roadmaps/${requestedRoadmapId}` : '/api/roadmaps/__empty__', tag: requestedRoadmapId ? `roadmap:${requestedRoadmapId}` : 'roadmap-empty' },
    { skip: !requestedRoadmapId },
  );
  const [request] = useRequestMutation();
  const loading = roadmapsQuery.isLoading || (!!requestedRoadmapId && roadmapQuery.isLoading);
  const hydratedKeyRef = useRef<string | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { roadmapRef.current = roadmap; }, [roadmap]);

  const draftKey = (id:string) => `roadmap:editor-draft:${id}`;
  const flash = useCallback((text:string) => { setNotice(text); window.setTimeout(() => setNotice(''), 1800); }, []);

  const snapshot = useCallback((next:EditorState) => {
    setHistory((h) => [...h.slice(-39), stateRef.current]);
    setFuture([]);
    setState(next);
    setDirty(true);
    activityPendingRef.current = true;
  }, []);

  useEffect(() => {
    if (!roadmap?.id || !dirty) return;
    const payload = { roadmap: { title: roadmap.title, description: roadmap.description, privacy: roadmap.privacy, topics: roadmap.topics }, state, savedAt: Date.now() };
    try { localStorage.setItem(draftKey(roadmap.id), JSON.stringify(payload)); } catch {}
  }, [roadmap, state, dirty]);

  useEffect(() => {
    const payload = roadmapQuery.data as any;
    if (!payload?.roadmap || !requestedRoadmapId) {
      if (!roadmapsQuery.isLoading && !requestedRoadmapId) setRoadmap(null);
      return;
    }

    const rawRoadmap = payload.roadmap as Partial<Roadmap>;
    const serverTopics: Topic[] = Array.isArray(rawRoadmap.topics) ? rawRoadmap.topics : [];
    const nextRoadmap = { ...rawRoadmap, topics: serverTopics } as Roadmap;
    const hydrationKey = `${nextRoadmap.id}:${roadmapQuery.fulfilledTimeStamp}`;
    if (hydratedKeyRef.current === hydrationKey) return;

    setAccessRole((payload?.accessRole || 'owner') as 'owner'|'editor'|'contributor'|'viewer');
    let draft:any = null;
    try {
      const raw = localStorage.getItem(draftKey(nextRoadmap.id));
      draft = raw ? JSON.parse(raw) : null;
    } catch {}

    const draftIsNewer = !!draft?.savedAt && Date.now() - Number(draft.savedAt) < 7 * 24 * 60 * 60 * 1000;
    const draftTopics: Topic[] = Array.isArray(draft?.roadmap?.topics) ? draft.roadmap.topics : [];
    const baseRoadmap = draftIsNewer && draft.roadmap ? {
      ...nextRoadmap,
      ...draft.roadmap,
      topics: serverTopics.map((serverTopic:any) => draftTopics.find((x:any) => x.id === serverTopic.id) || serverTopic),
    } : nextRoadmap;
    const baseTopics: Topic[] = Array.isArray(baseRoadmap.topics) ? baseRoadmap.topics : [];
    const rawEditorState = draftIsNewer && draft.state ? draft.state : (baseRoadmap.editorState || initialEditorState());
    const removedVisuals = Array.isArray(rawEditorState?.elements) && rawEditorState.elements.some((e:any) => REMOVED_ELEMENT_KINDS.has(e?.kind));
    const prepared = applyDefaults(rawEditorState, baseTopics);
    const initialDirty = draftIsNewer || removedVisuals;

    hydratedKeyRef.current = hydrationKey;
    setRoadmap({ ...baseRoadmap, topics: baseTopics });
    setState(prepared);
    setDirty(initialDirty);
    setHistory([]);
    setFuture([]);
    setLastActivityAt(nextRoadmap.updatedAt || null);
    activityPendingRef.current = initialDirty;
    setSelectedId((prev) => prev && (baseTopics.some(t=>t.id===prev) || prepared.elements.some(e=>e.id===prev)) ? prev : baseTopics[0]?.id || prepared.elements[0]?.id || null);
    if (removedVisuals && !draftIsNewer) flash('Removed unsupported visual blocks');
    if (draftIsNewer) flash('Recovered local changes');
  }, [roadmapQuery.data, roadmapQuery.fulfilledTimeStamp, requestedRoadmapId, roadmapsQuery.isLoading, flash]);

  useEffect(() => {
    if (!roadmap || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'topic') {
      void addTopic(null, 'topic');
      params.delete('action');
      const qs = params.toString();
      window.history.replaceState(null, '', `/roadmap${qs ? `?${qs}` : ''}`);
    }
  }, [roadmap?.id]);
  async function syncLatest() {
    const target = roadmapRef.current?.id;
    if (!target) return;
    if (dirty && !window.confirm('Sync latest roadmap? This will replace unsaved local changes with the latest server version.')) return;
    try {
      try { localStorage.removeItem(draftKey(target)); } catch {}
      await roadmapQuery.refetch();
      flash('Latest roadmap synced');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Sync failed');
      throw e;
    }
  }

  async function createRoadmap() {
    const name = window.prompt('Roadmap name', 'My Roadmap');
    if (!name?.trim()) return;
    try {
      const j:any = await request({url:'/api/roadmaps',method:'POST',body:{title:name.trim(),privacy:'private'},invalidate:['roadmaps']}).unwrap();
      setActiveRoadmapId(j.roadmap.id);
      window.history.replaceState(null,'',`/roadmap/${j.roadmap.id}`);
      flash('Roadmap created');
    } catch (e) { flash(e instanceof Error ? e.message : 'Could not create roadmap'); }
  }

  const addTopic = useCallback(async (parentId:string|null, fromKind:ElementKind='topic', position?:{x:number;y:number}) => {
    const currentRoadmap = roadmapRef.current;
    if (!currentRoadmap) return;
    const siblings = currentRoadmap.topics.filter(t => t.parentId === parentId);
    const siblingIndex = siblings.length;
    const title = parentId ? 'New Sub Topic' : 'New Topic';
    const res = await fetch('/api/topics', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({roadmapId:currentRoadmap.id,parentId,title,position:siblingIndex}) });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) return flash(j?.error || 'Could not add topic');
    if (j.queuedOffline) return flash('Topic creation queued · reconnect to sync');
    const topic:Topic = j.topic;
    setRoadmap(prev => prev ? {...prev,topics:[...prev.topics,topic]} : prev);
    setDirty(true); activityPendingRef.current = true; setSelectedId(topic.id);
    const currentState = stateRef.current;
    const parentPos = parentId ? currentState.topicPositions[parentId] : undefined;
    const base = position || parentPos || {x:600,y:120};
    const existing = Object.entries(currentState.topicPositions).map(([id,p]) => ({id,...p}));
    const hasPosition = (x:number,y:number) => existing.some(p => Math.abs(p.x-x) < 250 && Math.abs(p.y-y) < 90);
    let nextPos: {x:number;y:number};
    if (parentId && parentPos) {
      const columnX = parentPos.x + 360;
      const spread = 120;
      const candidates = [0, ...Array.from({length: 20}, (_, i) => {
        const step = Math.ceil((i + 1) / 2) * spread;
        return (i % 2 === 0 ? -1 : 1) * step;
      })];
      const offset = candidates.find(y => !hasPosition(columnX, parentPos.y + y)) ?? 0;
      nextPos = { x: columnX, y: parentPos.y + offset };
    } else {
      nextPos = { x: base.x, y: base.y + siblingIndex * 150 };
      let tries = 0;
      while (hasPosition(nextPos.x, nextPos.y) && tries < 20) {
        tries += 1;
        nextPos = { x: base.x + (tries % 2 ? 280 : -280), y: base.y + siblingIndex * 150 + Math.ceil(tries / 2) * 100 };
      }
    }
    setState(prev=>({ ...prev, topicPositions:{...prev.topicPositions, [topic.id]:nextPos} }));
    flash(fromKind==='subtopic'?'Sub topic added':'Topic added');
  }, [flash]);

  const addElement = useCallback((kind:ElementKind, point?:{x:number;y:number}) => {
    if (kind === 'topic') return void addTopic(null,kind,point);
    if (kind === 'subtopic') {
      const currentRoadmap = roadmapRef.current;
      const selectedTopic = currentRoadmap?.topics.find(t=>t.id===selectedId);
      return void addTopic(selectedTopic?.id || null,kind,point);
    }
    const currentState = stateRef.current;
    const defaults:Record<ElementKind,Partial<EditorElement>>={title:{text:'Frontend',body:'A roadmap section'},legend:{text:'Legend',body:'Purple = recommendation · Green = alternative · Grey = optional'},topic:{},subtopic:{}};
    const e:EditorElement = {
      id:`element-${crypto.randomUUID()}`, kind, text:defaults[kind].text || '', body:defaults[kind].body, url:defaults[kind].url,
      position:point || {x:180 + (currentState.elements.length % 4)*90,y:160 + (currentState.elements.length*75)%480},
      width:kind==='title'?320:250, height:undefined, style:kind==='title'?'highlight':'default',
      color: kind==='title' ? 'violet' : kind==='legend' ? 'slate' : 'indigo',
      fontSize: kind==='title' ? 22 : 12, fontWeight: kind==='title' ? 800 : 700, textAlign:'left', padding:12,
      borderRadius:14, borderWidth:1, opacity:1, shadow:'soft', zIndex:currentState.elements.length + 1, locked:false,
    };
    snapshot({...currentState,elements:[...currentState.elements,e]});
    setSelectedId(e.id);
  }, [addTopic, selectedId, snapshot]);

  const updateElement = useCallback((id:string, data:Partial<EditorElement>) => { const currentState = stateRef.current; snapshot({...currentState,elements:currentState.elements.map(e=>e.id===id?{...e,...data}:e)}); }, [snapshot]);
  const updateTopicColor = useCallback((id:string, color:string) => { const currentState = stateRef.current; snapshot({...currentState, topicColors: {...(currentState.topicColors || {}), [id]: color}}); }, [snapshot]);
  const updateTopicLocal = useCallback((id:string, data:Partial<Topic>) => { activityPendingRef.current = true; setDirty(true); setRoadmap(prev=>prev?{...prev,topics:prev.topics.map(t=>t.id===id?{...t,...data}:t)}:prev); }, []);

  const handleCanvasStateChange = useCallback((patch:{topicPositions?:Record<string,{x:number;y:number}>;elementPositions?:Record<string,{x:number;y:number}>;connections?:Edge[];viewport?:{x:number;y:number;zoom:number}}) => {
    let changed = false;
    setState(prev => {
      const next = {...prev};
      if (patch.topicPositions) {
        const merged = {...prev.topicPositions};
        for (const [id, pos] of Object.entries(patch.topicPositions)) {
          const old = merged[id];
          if (!old || old.x !== pos.x || old.y !== pos.y) { merged[id] = pos; changed = true; }
        }
        next.topicPositions = merged;
      }
      if (patch.elementPositions) {
        next.elements = prev.elements.map(e => {
          const pos = patch.elementPositions?.[e.id];
          if (!pos || (e.position.x === pos.x && e.position.y === pos.y)) return e;
          changed = true;
          return {...e, position:pos};
        });
      }
      if (patch.connections) {
        const same = prev.connections?.length === patch.connections.length && (prev.connections || []).every((e, i) => e.id === patch.connections?.[i]?.id && e.source === patch.connections?.[i]?.source && e.target === patch.connections?.[i]?.target);
        if (!same) { next.connections = patch.connections; changed = true; }
      }
      if (patch.viewport) {
        const v = prev.viewport;
        if (!v || v.x !== patch.viewport.x || v.y !== patch.viewport.y || v.zoom !== patch.viewport.zoom) { next.viewport = patch.viewport; changed = true; }
      }
      return changed ? next : prev;
    });
    if (changed) { setDirty(true); activityPendingRef.current = true; }
  }, []);

  const handleSelect = useCallback((id:string) => setSelectedId(id), []);
  const handleAddChild = useCallback((id:string) => { void addTopic(id,'subtopic'); }, [addTopic]);
  const handleManageResources = useCallback((id:string) => { setSelectedId(id); setInspector(true); }, []);
  const colorForTopic = useCallback((topic: { id:string; parentId:string | null }) => {
    const topics = roadmapRef.current?.topics || [];
    const sourceTopic = topics.find(t => t.id === topic.id);
    return colorPreset((stateRef.current.topicColors || {})[topic.id] || (sourceTopic ? defaultTopicColor(sourceTopic, topics) : 'gold'));
  }, []);
  const colorForElement = useCallback((element:EditorElement) => colorPreset(element.color), []);

  useEffect(() => {
    if (!roadmap?.id) return;
    const intervalMs = Math.max(60_000, Number(process.env.NEXT_PUBLIC_EDITOR_ACTIVITY_SYNC_MS || 60_000));
    activityTimerRef.current = window.setInterval(async () => {
      if (!activityPendingRef.current) return;
      try {
        const res = await fetch(`/api/roadmaps/${roadmap.id}/activity`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ at: new Date().toISOString() }), cache:'no-store' });
        if (res.ok) { const data = await res.json().catch(()=>null); activityPendingRef.current = false; if (data?.lastActivityAt) setLastActivityAt(data.lastActivityAt); }
      } catch {}
    }, intervalMs);
    return () => { if (activityTimerRef.current) window.clearInterval(activityTimerRef.current); };
  }, [roadmap?.id]);

  const persist = useCallback(async (silent=false, patch?:Partial<Pick<Roadmap,'title'|'description'|'privacy'>>) => {
    const currentRoadmap = roadmapRef.current;
    const currentState = stateRef.current;
    if (!currentRoadmap) return;
    const target = {...currentRoadmap,...patch};
    setSaving(true);
    try {
      const res = await fetch(`/api/roadmaps/${currentRoadmap.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:target.title,description:target.description,privacy:target.privacy,editorState:currentState}) });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || await res.text());
      if (j.queuedOffline) { if (!silent) flash('Saved locally · will sync when online'); return; }
      setRoadmap(prev=>prev?{...prev,...j.roadmap}:prev);
      setDirty(false);
      setLastActivityAt(j.roadmap?.updatedAt || new Date().toISOString());
      activityPendingRef.current = false;
      try { localStorage.removeItem(draftKey(currentRoadmap.id)); } catch {}
      if (!silent) flash('All changes saved');
    } catch (e) { if (!silent) flash(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }, [flash]);

  useEffect(() => {
    if (!dirty || !roadmap) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => { void persist(true); }, 1800);
    return () => { if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current); };
  }, [dirty, roadmap?.id, roadmap?.title, roadmap?.description, roadmap?.privacy, state, persist]);

  async function saveTopic(topic:Topic) {
    const res = await fetch(`/api/topics/${topic.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:topic.title,description:topic.description,notes:topic.notes,status:topic.status,progress:topic.progress,priority:topic.priority,tags:topic.tags,dueDate:topic.dueDate}) });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) return flash(j?.error || 'Topic save failed');
    if (j.queuedOffline) return flash('Topic saved locally · will sync when online');
    setRoadmap(prev=>prev?{...prev,topics:prev.topics.map(t=>t.id===topic.id?{...t,...j.topic}:t)}:prev); setDirty(true); flash('Topic saved');
  }

  async function createTopicShareLink(topicId:string) {
    const res = await fetch(`/api/topics/${topicId}/share-link`, { method:'POST' });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) return flash(j?.error || 'Could not create share link');
    const href = `${window.location.origin}${j.path}`;
    try { await navigator.clipboard.writeText(href); } catch {}
    setRoadmap(prev=>prev?{...prev,topics:prev.topics.map(t=>t.id===topicId?{...t,shareToken:j.topic?.shareToken}:t)}:prev);
    flash('Layer + children link copied');
  }

  async function addResource(topicId:string) {
    const topic = roadmap?.topics.find(t=>t.id===topicId);
    if (!topic) return;
    const title = window.prompt('Resource title', 'New resource');
    if (!title?.trim()) return;
    const url = window.prompt('Resource URL', 'https://');
    if (!url?.trim()) return;
    const res = await fetch('/api/resources', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({topicId,title:title.trim(),url:url.trim()}) });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) return flash(j?.error || 'Resource could not be added');
    if (j.queuedOffline) return flash('Resource queued locally · reconnect to sync');
    setRoadmap(prev=>prev?{...prev,topics:prev.topics.map(t=>t.id===topicId?{...t,resources:[...(t.resources||[]),j.resource]}:t)}:prev);
    setDirty(true);
    activityPendingRef.current = true;
    flash('Resource added');
  }

  async function updateResource(topicId:string, resource:Resource, data:Partial<Resource>) {
    const res = await fetch(`/api/resources/${resource.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) return flash(j?.error || 'Resource update failed');
    if (j.queuedOffline) return flash('Resource update queued locally');
    setRoadmap(prev=>prev?{...prev,topics:prev.topics.map(t=>t.id===topicId?{...t,resources:t.resources.map(r=>r.id===resource.id?{...r,...j.resource}:r)}:t)}:prev);
    setDirty(true);
    activityPendingRef.current = true;
    flash('Resource updated');
  }

  async function deleteResource(topicId:string, resource:Resource) {
    if (!confirm(`Delete “${resource.title}”?`)) return;
    const res = await fetch(`/api/resources/${resource.id}`, { method:'DELETE' });
    if (!res.ok) return flash(await res.text());
    setRoadmap(prev=>prev?{...prev,topics:prev.topics.map(t=>t.id===topicId?{...t,resources:t.resources.filter(r=>r.id!==resource.id)}:t)}:prev);
    setDirty(true);
    activityPendingRef.current = true;
    flash('Resource deleted');
  }

  async function deleteSelected() {
    if (!roadmap || !selectedId) return;
    const topic = roadmap.topics.find(t=>t.id===selectedId);
    if (topic) {
      if (!confirm(`Delete “${topic.title}” and its children?`)) return;
      const subtree = new Set<string>(); const visit=(id:string)=>{subtree.add(id);roadmap.topics.filter(t=>t.parentId===id).forEach(t=>visit(t.id));}; visit(topic.id);
      const res=await fetch(`/api/topics/${topic.id}`,{method:'DELETE'}); if(!res.ok)return flash(await res.text());
      setRoadmap(prev=>prev?{...prev,topics:prev.topics.filter(t=>!subtree.has(t.id))}:prev); setState(prev=>({...prev,topicPositions:Object.fromEntries(Object.entries(prev.topicPositions).filter(([id])=>!subtree.has(id)),)})); setSelectedId(null); setDirty(true); activityPendingRef.current = true; flash('Topic deleted'); return;
    }
    if ((state.connections||[]).some(e=>e.id===selectedId)) { snapshot({...state,connections:(state.connections||[]).filter(e=>e.id!==selectedId)}); setSelectedId(null); flash('Connection removed'); return; }
    snapshot({...state,elements:state.elements.filter(e=>e.id!==selectedId),connections:(state.connections||[]).filter(e=>e.source!==selectedId&&e.target!==selectedId)}); activityPendingRef.current = true; setSelectedId(null); flash('Element removed');
  }

  const undo = () => { const prev=history.at(-1); if(!prev) return; setFuture(f=>[state,...f].slice(0,40)); setHistory(h=>h.slice(0,-1)); setState(prev); setDirty(true); };
  const redo = () => { const next=future[0]; if(!next) return; setHistory(h=>[...h,state].slice(-40)); setFuture(f=>f.slice(1)); setState(next); setDirty(true); };

  const selectAndFocus = useCallback((id:string) => { setSelectedId(id); setFocusRequest(id); window.setTimeout(()=>setFocusRequest(null), 0); }, []);

  const resizeElement = useCallback((id:string, width:number, height?:number) => {
    const current = stateRef.current;
    const minW = 140, maxW = 900;
    const nextWidth = Math.max(minW, Math.min(maxW, Math.round(width)));
    const nextElements = current.elements.map(e => e.id===id ? {...e, width:nextWidth, height:height === undefined ? undefined : Math.max(48, Math.min(700, Math.round(height)))} : e);
    snapshot({...current, elements:nextElements});
  }, [snapshot]);

  const moveElementLayer = useCallback((id:string, direction:'front'|'back') => {
    const current = stateRef.current;
    const ordered = [...current.elements].sort((a,b)=>(a.zIndex ?? 0)-(b.zIndex ?? 0));
    if (!ordered.length) return;
    const min = ordered[0].zIndex ?? 0;
    const max = ordered[ordered.length-1].zIndex ?? ordered.length;
    const z = direction === 'front' ? max + 1 : min - 1;
    snapshot({...current, elements:current.elements.map(e=>e.id===id?{...e,zIndex:z}:e)});
  }, [snapshot]);

  const resetElementStyle = useCallback((id:string) => {
    const current = stateRef.current;
    snapshot({...current, elements:current.elements.map(e=>e.id===id?{...e,width:e.kind==='title'?320:250,height:undefined,fontSize:e.kind==='title'?22:12,fontWeight:e.kind==='title'?800:700,textAlign:'left',padding:12,borderRadius:14,borderWidth:1,opacity:1,shadow:'soft',zIndex:e.zIndex ?? 1,locked:false,style:e.kind==='title'?'highlight':'default'}:e)});
  }, [snapshot]);

  const selectedTopic = roadmap?.topics.find(t=>t.id===selectedId);
  const selectedElement = state.elements.find(e=>e.id===selectedId);
  const selectedConnection = state.connections?.find(e=>e.id===selectedId) || null;
  const searchMatches = useMemo(() => {
    const topics = roadmap?.topics ?? [];
    if (!search.trim()) return topics.length + state.elements.length;
    const q = search.trim().toLowerCase();
    return topics.filter(t => `${t.title} ${t.description} ${t.notes} ${t.tags.join(' ')} ${(t.resources||[]).map(r=>`${r.title} ${r.type} ${r.url}`).join(' ')}`.toLowerCase().includes(q)).length + state.elements.filter(e=>`${e.text} ${e.body||''} ${e.kind}`.toLowerCase().includes(q)).length;
  }, [roadmap?.topics, state.elements, search]);

  const commitRoadmapField = useCallback((patch:Partial<Pick<Roadmap,'title'|'description'|'privacy'>>) => {
    activityPendingRef.current = true;
    setRoadmap(prev => prev ? {...prev,...patch} : prev);
    setDirty(true);
  }, []);
  keyboardActionsRef.current = { persist:()=>void persist(), undo, redo, deleteSelected };
  useEffect(() => {
    const keydown=(e:KeyboardEvent)=>{
      const actions = keyboardActionsRef.current;
      if ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();actions.persist();}
      if ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();actions.undo();}
      if ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();actions.redo();}
      if (e.key==='Delete' && !['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName)){e.preventDefault();actions.deleteSelected();}
    };
    window.addEventListener('keydown',keydown); return()=>window.removeEventListener('keydown',keydown);
  }, []);

  if (loading) return <Card className="p-8"><div className="flex items-center justify-center gap-3 text-sm text-slate-500"><span className="studio-spinner"/>Loading roadmap editor…</div></Card>;
  if (!roadmap) return <Card className="p-12 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Network size={25}/></div><h2 className="mt-4 text-xl font-semibold">Create your first roadmap</h2><p className="mt-2 text-sm text-slate-500">Design a full visual roadmap with topics, resources, notes and custom blocks.</p><Button className="mt-5" onClick={createRoadmap}><Plus size={15}/> Create roadmap</Button></Card>;

  return <div className="studio-shell">
    <RoadmapHeader
      roadmap={roadmap}
      roadmapList={roadmapList}
      dirty={dirty}
      saving={saving}
      historyCount={history.length}
      futureCount={future.length}
      onLoad={(id)=>{setActiveRoadmapId(id);window.history.replaceState(null,'',`/roadmap/${id}`)}}
      onCreate={createRoadmap}
      onSync={syncLatest}
      onCommit={commitRoadmapField}
      onSave={(patch)=>void persist(false,patch)}
      onUndo={undo}
      onRedo={redo}
      onToggleChat={()=>setChatOpen(v=>!v)}
      inspector={inspector}
      chatOpen={chatOpen}
      readOnly={readOnly}
    />

    <div className="studio-layout">
      <aside className="studio-palette">
        <div className="studio-palette-head"><div><div className="text-sm font-semibold">Components</div><p className="text-[11px] text-slate-400">Drag or click to add</p></div><ZapIcon/></div>
        <div className="studio-palette-list">
          {palette.map(item=>{const Icon=item.icon;return <button key={item.kind} draggable onDragStart={e=>{e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('application/roadmap-kind',item.kind)}} onClick={()=>addElement(item.kind)} className="studio-palette-item"><span className="studio-palette-icon"><Icon size={16}/></span><span><strong>{item.label}</strong><small>{item.description}</small></span><GripVertical size={14} className="ml-auto text-slate-300"/></button>})}
        </div>
        <div className="studio-palette-footer"><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">Shortcuts</div><p><b>Ctrl/Cmd + S</b> save · <b>Ctrl/Cmd + Z</b> undo · <b>Delete</b> remove selected.</p></div>
      </aside>

      <section className="studio-canvas-pane">
        <div className="studio-canvas-toolbar">
          <div className="studio-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find topics, tags and resources…" aria-label="Search roadmap"/>{search&&<button onClick={()=>setSearch('')} aria-label="Clear search"><X size={13}/></button>}</div>
          <div className="studio-toolbar-actions">
            <span className="studio-search-count">{searchMatches} match{searchMatches===1?'':'es'}</span>
            <button className="studio-tool" onClick={()=>canvasRef.current?.fitView()} title="Fit all"><Maximize2 size={15}/></button>
            <button className="studio-tool" onClick={()=>canvasRef.current?.zoomOut()} title="Zoom out">−</button>
            <button className="studio-tool" onClick={()=>canvasRef.current?.zoomIn()} title="Zoom in">+</button>
            <button className={`studio-tool ${canvasLocked?'active':''}`} onClick={()=>setCanvasLocked(v=>!v)} title={canvasLocked?'Unlock canvas':'Lock canvas'}>{canvasLocked?<Lock size={15}/>:<Unlock size={15}/>}</button>
          </div>
        </div>
        <StudioCanvas
          roadmapId={roadmap.id}
          topics={roadmap.topics}
          elements={state.elements}
          topicPositions={state.topicPositions}
          topicColors={state.topicColors || {}}
          connections={state.connections || []}
          viewport={state.viewport}
          search={search}
          onSelect={selectAndFocus}
          onAddChild={handleAddChild}
          onManageResources={handleManageResources}
          onCanvasStateChange={handleCanvasStateChange}
          onAddElementAt={addElement}
          locked={canvasLocked || readOnly}
          focusId={focusRequest}
          selectedId={selectedId}
          onResizeElement={resizeElement}
          onUpdateElement={updateElement}
          ref={canvasRef}
          colorForTopic={colorForTopic}
          colorForElement={colorForElement}
        />
        <div className="studio-statusbar"><span>{roadmap.topics.length} topics · {state.elements.length} visual blocks · {(state.connections||[]).length} custom connections</span><span>{notice || (dirty ? 'Unsaved changes · auto-save enabled' : lastActivityAt ? `Last activity ${new Date(lastActivityAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'All changes saved')}</span></div>
      </section>

      {inspector && <aside className="studio-inspector">
        <div className="studio-inspector-head"><div><div className="text-sm font-semibold">Inspector</div><p className="text-[11px] text-slate-400">Edit data, style and resources</p></div><button className="studio-tool" onClick={()=>setInspector(false)}><X size={15}/></button></div>
        {!selectedTopic && !selectedElement ? <div className="studio-inspector-empty"><Settings2 size={22}/><p>Select a topic or visual block.</p><span>Double-click a block to edit.</span></div> : selectedTopic ? <TopicInspector readOnly={readOnly} topic={selectedTopic} colorId={state.topicColors?.[selectedTopic.id] || defaultTopicColor(selectedTopic, roadmap?.topics || [])} onColor={(c)=>updateTopicColor(selectedTopic.id,c)} onLocal={updateTopicLocal} onSave={saveTopic} onAddChild={()=>addTopic(selectedTopic.id,'subtopic')} onDelete={deleteSelected} onAddResource={()=>void addResource(selectedTopic.id)} onUpdateResource={(r,d)=>void updateResource(selectedTopic.id,r,d)} onDeleteResource={(r)=>void deleteResource(selectedTopic.id,r)} onCreateShareLink={()=>void createTopicShareLink(selectedTopic.id)} /> : selectedElement ? <ElementInspector readOnly={readOnly} element={selectedElement} onUpdate={updateElement} onDuplicate={()=>{const clone={...selectedElement,id:`element-${crypto.randomUUID()}`,position:{x:selectedElement.position.x+40,y:selectedElement.position.y+40},zIndex:Math.max(0,...state.elements.map(e=>e.zIndex??0))+1};snapshot({...state,elements:[...state.elements,clone]});setSelectedId(clone.id)}} onMoveLayer={moveElementLayer} onResetStyle={()=>resetElementStyle(selectedElement.id)} onDelete={deleteSelected} onSave={()=>void persist()} /> : <ConnectionInspector connection={selectedConnection} onDelete={deleteSelected} readOnly={readOnly} />}
      </aside>}
    </div>
    {chatOpen && <div className="studio-chat-panel"><div className="studio-chat-head"><div><div className="text-sm font-semibold">Roadmap Chat</div><p className="text-[11px] text-slate-400">Talk with people who can access this roadmap.</p></div><button className="studio-tool" onClick={()=>setChatOpen(false)} title="Close chat"><X size={15}/></button></div><div className="studio-chat-body"><GroupChat roadmapId={roadmap.id} label="Roadmap Chat" description="Messages are shared with people who can access this roadmap."/></div></div>}
  </div>;
}

function ZapIcon(){return <div className="grid size-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><ArrowRight size={16}/></div>;}

function TopicInspector({readOnly,topic,colorId,onColor,onLocal,onSave,onAddChild,onDelete,onAddResource,onUpdateResource,onDeleteResource,onCreateShareLink}:{readOnly:boolean;topic:Topic;colorId:string;onColor:(color:string)=>void;onLocal:(id:string,data:Partial<Topic>)=>void;onSave:(t:Topic)=>Promise<void>;onAddChild:()=>void;onDelete:()=>void;onAddResource:()=>void;onUpdateResource:(r:Resource,d:Partial<Resource>)=>void;onDeleteResource:(r:Resource)=>void;onCreateShareLink:()=>void}){
  const [editingResource,setEditingResource]=useState<string|null>(null);
  const [draft,setDraft]=useState<Partial<Resource>>({});
  const [draftTopic,setDraftTopic]=useState<Partial<Topic>>({});
  const [personalStatus,setPersonalStatus]=useState<'learning'|'done'|'skipped'>('learning');
  const [personalSaving,setPersonalSaving]=useState(false);
   const progressQuery = useGetJsonQuery({url:`/api/topics/${topic.id}/progress`,tag:`topic-progress:${topic.id}`});
   useEffect(()=>{const status=(progressQuery.data as any)?.progress?.status;if(status)setPersonalStatus(status)},[progressQuery.data]);
  const commitField=(field:keyof Topic,value:unknown)=>{
    if (readOnly) return;
    const patch={ [field]: value } as Partial<Topic>;
    setDraftTopic(prev=>({...prev,...patch}));
    onLocal(topic.id,patch);
  };
  const mergedTopic={...topic,...draftTopic} as Topic;
  const saveDraft=async()=>{ if(readOnly)return; await onSave(mergedTopic); setDraftTopic({}); };
  return <div className="studio-inspector-body">
    <div className="studio-section-label">TOPIC</div>
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
      <div className="text-sm font-semibold">{topic.title}</div>
      <div className="mt-1 text-[10px] text-slate-500">{readOnly ? 'Read-only shared access' : 'Edit the roadmap node and its learning resources.'}</div>
    </div>
    <div className="mt-3 rounded-xl border border-[hsl(var(--line))] p-3"><div className="text-[9px] font-extrabold uppercase tracking-[.18em] text-slate-400">Your learning status</div><div className="mt-2 grid grid-cols-3 gap-1.5">{(['learning','done','skipped'] as const).map(status=><button key={status} disabled={personalSaving} onClick={async()=>{setPersonalSaving(true);try{const r=await fetch(`/api/topics/${topic.id}/progress`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});if(r.ok){const j=await r.json();setPersonalStatus(j.progress.status)}}finally{setPersonalSaving(false)}}} className={`rounded-lg border px-2 py-2 text-[9px] font-semibold ${personalStatus===status?'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300':'border-[hsl(var(--line))]'}`}>{status==='learning'?'Learning':status==='done'?'✓ Done':'× Skip'}</button>)}</div></div>
    <label className="studio-field mt-3">Title<input disabled={readOnly} value={draftTopic.title ?? topic.title} onChange={e=>setDraftTopic(prev=>({...prev,title:e.target.value}))} onBlur={e=>commitField('title',e.currentTarget.value)}/></label>
    <label className="studio-field">Description<textarea disabled={readOnly} value={draftTopic.description ?? topic.description} onChange={e=>setDraftTopic(prev=>({...prev,description:e.target.value}))} onBlur={e=>commitField('description',e.currentTarget.value)}/></label>
    <label className="studio-field">Notes / Markdown<textarea disabled={readOnly} className="h-28" value={draftTopic.notes ?? topic.notes} onChange={e=>setDraftTopic(prev=>({...prev,notes:e.target.value}))} onBlur={e=>commitField('notes',e.currentTarget.value)}/></label>
    <div className="grid grid-cols-2 gap-2"><label className="studio-field">Status<select disabled={readOnly} value={draftTopic.status ?? topic.status} onChange={e=>commitField('status',e.target.value as Topic['status'])}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label><label className="studio-field">Progress<input disabled={readOnly} type="number" min="0" max="100" value={draftTopic.progress ?? topic.progress} onChange={e=>commitField('progress',Math.max(0,Math.min(100,Number(e.target.value)||0)))}/></label></div>
    <div className="grid grid-cols-2 gap-2"><label className="studio-field">Priority<select disabled={readOnly} value={draftTopic.priority ?? topic.priority} onChange={e=>commitField('priority',Number(e.target.value))}><option value="0">None</option><option value="1">Low</option><option value="2">Medium</option><option value="3">High</option><option value="4">Urgent</option></select></label><label className="studio-field">Due date<input disabled={readOnly} type="date" value={(draftTopic.dueDate ?? topic.dueDate)?.slice(0,10) || ''} onChange={e=>commitField('dueDate',e.target.value||null)}/></label></div>
    <label className="studio-field">Tags<input disabled={readOnly} value={(draftTopic.tags ?? topic.tags).join(', ')} onChange={e=>setDraftTopic(prev=>({...prev,tags:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))} onBlur={e=>commitField('tags',e.currentTarget.value.split(',').map(x=>x.trim()).filter(Boolean))}/></label>
    <div className="studio-section-label mt-3">COLOR</div>
    <div className="studio-color-grid" role="radiogroup" aria-label="Topic color">
      {COLOR_PRESETS.map(c=><button key={c.id} disabled={readOnly} type="button" className={`studio-color-swatch ${colorId===c.id?'selected':''}`} title={c.label} aria-label={c.label} onClick={()=>onColor(c.id)} style={{background:c.bg,borderColor:c.border}}><span style={{background:c.dot}} /></button>)}
      <label className="studio-color-custom" title="Custom color"><input disabled={readOnly} type="color" value={colorPreset(colorId).border} onChange={e=>onColor(e.target.value)} aria-label="Custom topic color"/><span>+</span></label>
    </div>
    {!readOnly && <div className="grid grid-cols-2 gap-2"><Button onClick={()=>void saveDraft()}><Save size={14}/> Save topic</Button><Button variant="outline" onClick={onAddChild}><Plus size={14}/> Child</Button></div>}
    <div className="studio-inspector-divider"/>
    <div className="flex items-center justify-between"><div className="studio-section-label mb-0">RESOURCES ({topic.resources?.length || 0})</div>{!readOnly && <button className="studio-inline-add" onClick={onAddResource}><Plus size={13}/> Add</button>}</div>
    <div className="mt-2 space-y-2">
      {topic.resources?.map(r=>{
        const isEditing=editingResource===r.id;
        if (isEditing && !readOnly) return <div key={r.id} className="studio-resource studio-resource-editable"><span className="studio-resource-icon"><Link2 size={13}/></span><div className="min-w-0 flex-1 grid gap-1.5"><input className="studio-mini-input" placeholder="Title" value={(draft.title as string) ?? r.title} onChange={e=>setDraft({...draft,title:e.target.value})}/><input className="studio-mini-input" placeholder="URL" value={(draft.url as string) ?? r.url} onChange={e=>setDraft({...draft,url:e.target.value})}/><select className="studio-mini-input" value={(draft.type as string) ?? r.type ?? ''} onChange={e=>setDraft({...draft,type:e.target.value})}><option value="">Auto detect type</option><option value="article">Article</option><option value="video">Video</option><option value="documentation">Documentation</option><option value="github">GitHub</option><option value="course">Course</option><option value="other">Other</option></select><textarea className="studio-mini-input min-h-16" placeholder="Notes" value={(draft.notes as string) ?? r.notes ?? ''} onChange={e=>setDraft({...draft,notes:e.target.value})}/><div className="flex flex-wrap gap-2 text-[10px]"><label className="inline-flex items-center gap-1"><input type="checkbox" checked={(draft.completed as boolean) ?? r.completed} onChange={e=>setDraft({...draft,completed:e.target.checked})}/> Completed</label><label className="inline-flex items-center gap-1"><input type="checkbox" checked={(draft.favorite as boolean) ?? r.favorite} onChange={e=>setDraft({...draft,favorite:e.target.checked})}/> Favorite</label></div></div><div className="flex items-center gap-1"><button className="studio-mini-action" onClick={()=>{onUpdateResource(r,draft);setEditingResource(null);setDraft({});}} title="Save resource"><Check size={12}/></button><button className="studio-mini-action" onClick={()=>{setEditingResource(null);setDraft({});}} title="Cancel"><X size={12}/></button></div></div>;
        return <div key={r.id} className="studio-resource"><span className="studio-resource-icon"><Link2 size={13}/></span><div className="min-w-0 flex-1"><a href={r.url} target="_blank" rel="noreferrer" className="block"><strong>{r.title}</strong><small>{r.type || 'link'}{r.favorite ? ' · Favorite' : ''}{r.completed ? ' · Done' : ''}</small></a>{r.notes&&<p className="mt-1 text-[9px] leading-4 text-slate-400">{r.notes}</p>}</div>{!readOnly && <div className="flex items-center gap-1"><button className="studio-mini-action" title="Edit resource" onClick={()=>{setEditingResource(r.id);setDraft({title:r.title,url:r.url,type:r.type,notes:r.notes,completed:r.completed,favorite:r.favorite});}}><Settings2 size={12}/></button><button className="studio-mini-action" title="Delete resource" onClick={()=>onDeleteResource(r)}><Trash2 size={12}/></button></div>}</div>;
      })}
      {!topic.resources?.length&&<p className="text-xs text-slate-400">Add documentation, videos, articles, GitHub links or courses to this topic.</p>}
    </div>
    {!readOnly && <><div className="studio-inspector-divider"/><div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20"><div className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">Share this layer</div><p className="mt-1 text-[11px] text-indigo-700/80 dark:text-indigo-200/80">Only this topic and every child below it are exposed.</p><div className="mt-2 flex flex-wrap items-center gap-2"><Button variant="outline" onClick={onCreateShareLink}><Share2 size={13}/> {topic.shareToken ? 'Copy layer link' : 'Create layer link'}</Button>{topic.shareToken && <><a className="text-[11px] text-indigo-600 underline" href={`/share/topic/${topic.shareToken}`} target="_blank" rel="noreferrer">Open</a><button className="text-[11px] text-red-600" onClick={async()=>{const r=await fetch(`/api/topics/${topic.id}/share-link`,{method:'DELETE'});if(r.ok)onLocal(topic.id,{shareToken:null} as any);}}>Revoke</button></>}</div>{topic.shareToken && <div className="mt-2 break-all text-[10px] text-slate-500">/share/topic/{topic.shareToken}</div>}</div><button onClick={onDelete} className="studio-danger"><Trash2 size={14}/> Delete topic and children</button></>}
  </div>;
}

function ConnectionInspector({connection,onDelete,readOnly}:{connection:Edge|null;onDelete:()=>void;readOnly:boolean}){
  if(!connection) return <div className="studio-inspector-empty"><Network size={22}/><p>Select a connection.</p></div>;
  return <div className="studio-inspector-body"><div className="studio-section-label">CONNECTION</div><div className="rounded-xl border border-[hsl(var(--line))] p-3 text-xs"><div><b>From</b> <span className="text-slate-500">{connection.source}</span></div><div className="mt-2"><b>To</b> <span className="text-slate-500">{connection.target}</span></div><div className="mt-2"><b>Type</b> <span className="text-slate-500">{connection.type || 'smoothstep'}</span></div></div>{!readOnly && <><div className="studio-inspector-divider"/><button onClick={onDelete} className="studio-danger"><Trash2 size={14}/> Delete connection</button></>}</div>;
}

function ElementInspector({element,readOnly,onUpdate,onDuplicate,onMoveLayer,onResetStyle,onDelete,onSave}:{element:EditorElement;readOnly:boolean;onUpdate:(id:string,d:Partial<EditorElement>)=>void;onDuplicate:()=>void;onMoveLayer:(id:string,direction:'front'|'back')=>void;onResetStyle:()=>void;onDelete:()=>void;onSave:()=>void}){
  const [draft,setDraft]=useState<EditorElement>(element);
  useEffect(()=>setDraft(element),[element.id, element.text, element.body, element.url, element.width, element.height, element.fontSize, element.fontWeight, element.textAlign, element.padding, element.borderRadius, element.borderWidth, element.opacity, element.shadow, element.zIndex, element.locked, element.style, element.color]);
  const patch=(data:Partial<EditorElement>, commit=false)=>{ const next={...draft,...data}; setDraft(next); if(commit) onUpdate(element.id,data); };
  const commitText=()=>{ const keys:['text','body','url']=['text','body','url']; const delta:Partial<EditorElement>={}; for(const k of keys) if(draft[k]!==element[k]) (delta as any)[k]=draft[k]; if(Object.keys(delta).length) onUpdate(element.id,delta); };
  return <div className="studio-inspector-body">
    <div className="studio-section-label">{element.kind.toUpperCase()} BLOCK</div>
    <div className="studio-field-grid"><label className="studio-field">Text<input disabled={readOnly} value={draft.text} onChange={e=>setDraft(d=>({...d,text:e.target.value}))} onBlur={commitText}/></label><label className="studio-field">URL<input disabled={readOnly} value={draft.url || ''} placeholder="https://…" onChange={e=>setDraft(d=>({...d,url:e.target.value || undefined}))} onBlur={commitText}/></label></div>
    <label className="studio-field">Body<textarea disabled={readOnly} value={draft.body || ''} onChange={e=>setDraft(d=>({...d,body:e.target.value}))} onBlur={commitText}/></label>
    <div className="studio-section-label mt-3">LAYOUT</div>
    <div className="grid grid-cols-2 gap-2">
      <label className="studio-field">Width<input disabled={readOnly} type="number" min="140" max="900" value={draft.width ?? 250} onChange={e=>patch({width:Math.max(140,Math.min(900,Number(e.target.value)||250))},true)}/></label>
      <label className="studio-field">Height<input disabled={readOnly} type="number" min="48" max="700" value={draft.height ?? ''} placeholder="Auto" onChange={e=>patch({height:e.target.value===''?undefined:Math.max(48,Math.min(700,Number(e.target.value)||48))},true)}/></label>
      <label className="studio-field">X<input disabled={readOnly} type="number" value={Math.round(draft.position.x)} onChange={e=>patch({position:{...draft.position,x:Number(e.target.value)||0}},true)}/></label>
      <label className="studio-field">Y<input disabled={readOnly} type="number" value={Math.round(draft.position.y)} onChange={e=>patch({position:{...draft.position,y:Number(e.target.value)||0}},true)}/></label>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <label className="studio-field">Padding<input disabled={readOnly} type="number" min="4" max="36" value={draft.padding ?? 12} onChange={e=>patch({padding:Math.max(4,Math.min(36,Number(e.target.value)||4))},true)}/></label>
      <label className="studio-field">Radius<input disabled={readOnly} type="number" min="0" max="32" value={draft.borderRadius ?? 14} onChange={e=>patch({borderRadius:Math.max(0,Math.min(32,Number(e.target.value)||0))},true)}/></label>
      <label className="studio-field">Border<input disabled={readOnly} type="number" min="0" max="6" value={draft.borderWidth ?? 1} onChange={e=>patch({borderWidth:Math.max(0,Math.min(6,Number(e.target.value)||0))},true)}/></label>
      <label className="studio-field">Opacity<input disabled={readOnly} type="number" min="0.2" max="1" step="0.05" value={draft.opacity ?? 1} onChange={e=>patch({opacity:Math.max(.2,Math.min(1,Number(e.target.value)||1))},true)}/></label>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <label className="studio-field">Font size<select disabled={readOnly} value={draft.fontSize ?? 12} onChange={e=>patch({fontSize:Number(e.target.value)},true)}>{[10,11,12,13,14,16,18,20,22,24,28].map(v=><option key={v} value={v}>{v}px</option>)}</select></label>
      <label className="studio-field">Weight<select disabled={readOnly} value={draft.fontWeight ?? 700} onChange={e=>patch({fontWeight:Number(e.target.value)},true)}><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Heavy</option></select></label>
      <label className="studio-field">Align<select disabled={readOnly} value={draft.textAlign ?? 'left'} onChange={e=>patch({textAlign:e.target.value as EditorElement['textAlign']},true)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
      <label className="studio-field">Shadow<select disabled={readOnly} value={draft.shadow ?? 'soft'} onChange={e=>patch({shadow:e.target.value as EditorElement['shadow']},true)}><option value="none">None</option><option value="soft">Soft</option><option value="strong">Strong</option></select></label>
    </div>
    <div className="studio-section-label mt-3">STYLE</div>
    <label className="studio-field">Preset<select disabled={readOnly} value={draft.style || 'default'} onChange={e=>patch({style:e.target.value as EditorElement['style']},true)}><option value="default">Default</option><option value="highlight">Highlight</option><option value="muted">Muted</option></select></label>
    <div className="studio-color-grid" role="radiogroup" aria-label="Block color">{COLOR_PRESETS.map(c=><button key={c.id} disabled={readOnly} type="button" className={`studio-color-swatch ${(draft.color||'')===c.id?'selected':''}`} title={c.label} aria-label={c.label} onClick={()=>patch({color:c.id},true)} style={{background:c.bg,borderColor:c.border}}><span style={{background:c.dot}} /></button>)}<label className="studio-color-custom" title="Custom color"><input disabled={readOnly} type="color" value={colorPreset(draft.color).border} onChange={e=>patch({color:e.target.value},true)} aria-label="Custom block color"/><span>+</span></label></div>
    <div className="flex flex-wrap gap-2 mt-2">
      <button disabled={readOnly} className="studio-inline-action" onClick={()=>patch({locked:!draft.locked},true)}>{draft.locked?<UnlockKeyhole size={13}/>:<LockKeyhole size={13}/>} {draft.locked?'Unlock':'Lock'} position</button>
      <button disabled={readOnly} className="studio-inline-action" onClick={()=>onMoveLayer(element.id,'back')}><Layers size={13}/> Send back</button>
      <button disabled={readOnly} className="studio-inline-action" onClick={()=>onMoveLayer(element.id,'front')}><Layers size={13}/> Bring front</button>
    </div>
    <div className="grid grid-cols-2 gap-2 mt-3">{!readOnly && <Button variant="outline" onClick={onDuplicate}><Copy size={14}/> Duplicate</Button>}{!readOnly && <Button variant="outline" onClick={onResetStyle}><RotateCcw size={14}/> Reset style</Button>}</div>
    {!readOnly && <Button className="mt-2 w-full" onClick={onSave}><Save size={14}/> Save block</Button>}
    {!readOnly && <><div className="studio-inspector-divider"/><button onClick={onDelete} className="studio-danger"><Trash2 size={14}/> Delete block</button></>}
  </div>;
}

export function RoadmapEditor({ initialRoadmapId }: { initialRoadmapId?: string } = {}) { return <ReactFlowProvider><StudioInner initialRoadmapId={initialRoadmapId}/></ReactFlowProvider>; }
