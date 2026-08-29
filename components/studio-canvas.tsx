'use client';

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  ReactFlowProvider,
} from 'reactflow';
import { ExternalLink, FileText, Link2, List, MoreHorizontal, Network, Plus, Type, Check } from 'lucide-react';
import 'reactflow/dist/style.css';

type Resource = { id: string; title: string; url: string; type: string; notes: string; completed: boolean; favorite: boolean };
export type StudioTopic = {
  id: string; parentId: string | null; title: string; description: string; notes: string;
  status: 'not_started' | 'in_progress' | 'completed'; progress: number; priority?: number; position?: number; tags: string[]; resources: Resource[];
};
type EditorElement = {
  id: string; kind: 'title'|'topic'|'subtopic'|'legend'; text: string; body?: string; url?: string;
  position: { x:number; y:number }; width?: number; height?: number; style?: 'default'|'highlight'|'muted'; color?: string;
  fontSize?: number; fontWeight?: number; textAlign?: 'left'|'center'|'right'; padding?: number; borderRadius?: number;
  borderWidth?: number; opacity?: number; shadow?: 'none'|'soft'|'strong'; zIndex?: number; locked?: boolean;
};
type CanvasData = {
  topic?: StudioTopic;
  element?: EditorElement;
  root?: boolean;
  selected?: boolean;
  color?: { bg:string; border:string; text:string; dot:string };
  onSelect: (id:string)=>void;
  onAddChild: (id:string)=>void;
  onManageResources: (id:string)=>void;
  onUpdateElement?: (id:string, data:Partial<EditorElement>)=>void;
  onResizeElement?: (id:string, width:number, height?:number)=>void;
};
type CanvasNode = Node<CanvasData>;

export type StudioCanvasHandle = {
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;
  focus: (id: string) => void;
};

type Props = {
  roadmapId: string;
  topics: StudioTopic[];
  elements: EditorElement[];
  topicPositions: Record<string, {x:number;y:number}>;
  topicColors: Record<string,string>;
  connections: Edge[];
  viewport?: {x:number;y:number;zoom:number};
  search: string;
  locked?: boolean;
  showLockBadge?: boolean;
  focusId?: string | null;
  onSelect: (id: string) => void;
  onAddChild: (id: string) => void;
  onManageResources: (id: string) => void;
  onCanvasStateChange: (patch: {
    topicPositions?: Record<string,{x:number;y:number}>;
    elementPositions?: Record<string,{x:number;y:number}>;
    connections?: Edge[];
    viewport?: {x:number;y:number;zoom:number};
  }) => void;
  onAddElementAt: (kind: EditorElement['kind'], point: {x:number;y:number}) => void;
  colorForTopic: (topic: StudioTopic) => { bg:string; border:string; text:string; dot:string };
  colorForElement: (element: EditorElement) => { bg:string; border:string; text:string; dot:string };
  onUpdateElement?: (id:string, data:Partial<EditorElement>) => void;
  onResizeElement?: (id:string, width:number, height?:number) => void;
  selectedId?: string | null;
};

function TopicNodeView({ data }: NodeProps<CanvasData>) {
  const topic = data.topic!;
  const [hoverOpen, setHoverOpen] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openHover = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setHoverOpen(true);
  };

  const scheduleHideHover = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setHoverOpen(false), 2000);
  };

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const c = data.color;
  return (
    <div className={data.root ? 'editor-topic-node is-root' : 'editor-topic-node'} onMouseEnter={openHover} onMouseLeave={scheduleHideHover} style={{ '--topic-bg': c?.bg, '--topic-border': c?.border, '--topic-text': c?.text, '--topic-dot': c?.dot } as React.CSSProperties}>
      <Handle type="target" position={Position.Left} className="editor-handle" />
      <button type="button" className="editor-topic-main nodrag" onClick={() => data.onSelect(topic.id)}>
        <span className={`editor-topic-status editor-status-${topic.status}`}><Check size={11}/></span>
        <span className="min-w-0 flex-1">
          <span className="editor-topic-title">{topic.title}</span>
          <span className="editor-topic-subtitle">{topic.description || `${topic.resources?.length || 0} resources · ${topic.progress}%`}</span>
        </span>
        <MoreHorizontal size={15}/>
      </button>
      <div className="editor-topic-progress"><span style={{ width:`${Math.max(0, Math.min(100, topic.progress))}%` }}/></div>
      <div className={`editor-topic-hover-card ${hoverOpen ? 'is-visible' : ''}`} role="tooltip" onMouseEnter={openHover} onMouseLeave={scheduleHideHover}>
        <div className="font-semibold">{topic.title}</div>
        <div className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-300">{topic.description || 'No description yet.'}</div>
        <div className="mt-2 grid grid-cols-2 gap-1 text-[9px]"><span>{topic.progress}% complete</span><span>{topic.resources?.length || 0} resources</span></div>
        {topic.resources?.slice(0,3).map(r => <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[9px] font-medium text-indigo-600 dark:text-indigo-300">↗ {r.title}</a>)}
      </div>
      <div className="editor-topic-actions nodrag">
        <button type="button" onClick={() => data.onSelect(topic.id)}>Edit</button>
        <button type="button" onClick={() => data.onAddChild(topic.id)}><Plus size={12}/> Child</button>
        <button type="button" onClick={() => data.onManageResources(topic.id)}><Link2 size={11}/> Links</button>
      </div>
      <Handle type="source" position={Position.Right} className="editor-handle" />
    </div>
  );
}
const TopicNode = memo(TopicNodeView, (a,b) => (
  a.data.topic === b.data.topic && a.data.root === b.data.root && a.data.selected === b.data.selected &&
  a.data.color?.bg === b.data.color?.bg && a.data.color?.border === b.data.color?.border &&
  a.data.color?.text === b.data.color?.text && a.data.color?.dot === b.data.color?.dot
));

function ElementNodeView({ data }: NodeProps<CanvasData>) {
  const e = data.element!;
  const [size,setSize]=useState({width:e.width ?? (e.kind==='title'?320:250),height:e.height ?? 72});
  const resizeRef=useRef<{startX:number;startY:number;width:number;height:number}|null>(null);
  useEffect(()=>setSize({width:e.width ?? (e.kind==='title'?320:250),height:e.height ?? 72}),[e.id,e.width,e.height]);
  const Icon = e.kind === 'title' ? Type : e.kind === 'legend' ? List : e.kind === 'subtopic' ? Network : FileText;
  const c = data.color!;
  const shadow=e.shadow==='strong'?'0 16px 36px rgba(15,23,42,.18)':e.shadow==='none'?'none':'0 8px 20px rgba(15,23,42,.09)';
  const startResize=(event:React.PointerEvent<HTMLButtonElement>)=>{
    if(e.locked) return;
    event.preventDefault(); event.stopPropagation();
    resizeRef.current={startX:event.clientX,startY:event.clientY,width:size.width,height:size.height};
    const sizeRef={current:{...size}};
    const up=()=>{ const final=sizeRef.current; data.onResizeElement?.(e.id,final.width,final.height); resizeRef.current=null; window.removeEventListener('pointermove',move2); window.removeEventListener('pointerup',up); };
    const move2=(ev:PointerEvent)=>{ const r=resizeRef.current; if(!r)return; const nextW=Math.max(140,Math.min(900,Math.round(r.width+(ev.clientX-r.startX)))); const nextH=Math.max(48,Math.min(700,Math.round(r.height+(ev.clientY-r.startY)))); sizeRef.current={width:nextW,height:nextH}; setSize(sizeRef.current); };
    window.addEventListener('pointermove',move2); window.addEventListener('pointerup',up,{once:true});
  };
  const content=(<span className="editor-element-body" style={{padding:e.padding??12,fontSize:e.fontSize??12,fontWeight:e.fontWeight??700,textAlign:e.textAlign??'left'}}><span className="editor-element-icon"><Icon size={14}/></span><span className="min-w-0 flex-1"><strong>{e.text || e.kind}</strong>{e.body&&<small>{e.body}</small>}</span>{e.url&&<ExternalLink size={12}/>}</span>);
  return <div className={`editor-element editor-element-${e.kind} ${e.style==='highlight'?'is-highlight':e.style==='muted'?'is-muted':''} ${data.selected?'is-selected':''} ${e.locked?'is-block-locked':''}`} style={{'--element-bg':c.bg,'--element-border':c.border,'--element-text':c.text,'--element-dot':c.dot,width:size.width,minHeight:size.height,height:e.height?size.height:undefined,borderRadius:e.borderRadius??14,borderWidth:e.borderWidth??1,opacity:e.opacity??1,boxShadow:shadow,zIndex:e.zIndex??1} as React.CSSProperties} onDoubleClick={()=>data.onSelect(e.id)}>
    {e.url?<a href={e.url} target="_blank" rel="noreferrer" className="nodrag">{content}</a>:<button type="button" onClick={()=>data.onSelect(e.id)} className="nodrag">{content}</button>}
    {data.selected&&!e.locked&&<button type="button" className="editor-resize-handle editor-resize-se nodrag" aria-label="Resize block" onPointerDown={startResize} />}
  </div>;
}

const ElementNode = memo(ElementNodeView, (a,b) => (
  a.data.element === b.data.element && a.data.selected === b.data.selected && a.data.color?.bg === b.data.color?.bg &&
  a.data.color?.border === b.data.color?.border && a.data.color?.text === b.data.color?.text && a.data.color?.dot === b.data.color?.dot
));

const nodeTypes = { topic: TopicNode, element: ElementNode };

function buildFilteredTopics(topics: StudioTopic[], search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return topics;
  const matched = new Set(topics.filter(t => `${t.title} ${t.description} ${t.notes} ${t.tags.join(' ')} ${(t.resources || []).map(r => `${r.title} ${r.type} ${r.url}`).join(' ')}`.toLowerCase().includes(q)).map(t=>t.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of topics) {
      if (t.parentId && matched.has(t.id) && !matched.has(t.parentId)) { matched.add(t.parentId); changed = true; }
    }
  }
  return topics.filter(t => matched.has(t.id));
}

export const StudioCanvas = memo(forwardRef<StudioCanvasHandle, Props>(function StudioCanvas({
  roadmapId, topics, elements, topicPositions, topicColors, connections, viewport, search, locked = false, showLockBadge = true, focusId, selectedId,
  onSelect, onAddChild, onManageResources, onCanvasStateChange, onAddElementAt, onUpdateElement, onResizeElement, colorForTopic, colorForElement,
}, ref) {
  const rf = useReactFlow();
  const rfRef = useRef(rf);
  rfRef.current = rf;
  const nodesRef = useRef<CanvasNode[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(connections);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  const previousRoadmapIdRef = useRef('');
  const didInitialFitRef = useRef(false);

  const filteredTopics = useMemo(() => buildFilteredTopics(topics, search), [topics, search]);
  const visibleIds = useMemo(() => new Set([...filteredTopics.map(t=>t.id), ...elements.map(e=>e.id)]), [filteredTopics, elements]);
  const baseNodes = useMemo<CanvasNode[]>(() => [
    ...filteredTopics.map(t => ({ id:t.id, type:'topic', position:topicPositions[t.id] || {x:600,y:120}, data:{ topic:t, root:!t.parentId, selected:t.id===selectedId, color:colorForTopic(t), onSelect, onAddChild, onManageResources } } as CanvasNode)),
    ...elements.map(e => ({ id:e.id, type:'element', position:e.position, data:{ element:e, selected:e.id===selectedId, color:colorForElement(e), onSelect, onAddChild, onManageResources, onUpdateElement, onResizeElement } } as CanvasNode)),
  ], [filteredTopics, elements, topicPositions, selectedId, colorForTopic, colorForElement, onSelect, onAddChild, onManageResources, onUpdateElement, onResizeElement]);
  const baseEdges = useMemo<Edge[]>(() => {
    const hierarchy = topics.filter(t => t.parentId && visibleIds.has(t.parentId) && visibleIds.has(t.id)).map(t => ({
      id:`hier-${t.parentId}-${t.id}`, source:t.parentId!, target:t.id, type:'default', selectable:false, pathOptions:{ curvature:0.28 },
      style:{ stroke:'hsl(218 84% 64%)', strokeWidth:2 }, animated:t.status==='in_progress',
    } as Edge));
    return [...hierarchy, ...(connections || []).filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))];
  }, [topics, connections, visibleIds]);

  useEffect(() => {
    if (previousRoadmapIdRef.current === roadmapId) return;
    previousRoadmapIdRef.current = roadmapId;
    didInitialFitRef.current = false;
    setNodes(baseNodes);
    setEdges(baseEdges);
    requestAnimationFrame(() => {
      if (viewport) rfRef.current.setViewport(viewport, { duration:0 });
      else if (baseNodes.length) rfRef.current.fitView({ padding:0.12, duration:0 });
      didInitialFitRef.current = true;
    });
  }, [roadmapId]);

  useEffect(() => {
    setNodes(current => {
      const byId = new Map(current.map(n => [n.id, n]));
      let changed = current.length !== baseNodes.length;
      const nextNodes = baseNodes.map(next => {
        const existing = byId.get(next.id);
        if (!existing) { changed = true; return next; }
        const samePosition = existing.position.x === next.position.x && existing.position.y === next.position.y;
        const sameData = existing.data.topic === next.data.topic && existing.data.element === next.data.element && existing.data.color === next.data.color && existing.data.root === next.data.root;
        if (samePosition && sameData) return existing;
        changed = true;
        return { ...existing, data: next.data, position: next.position };
      });
      return changed ? nextNodes : current;
    });
  }, [baseNodes, setNodes]);

  useEffect(() => {
    setEdges(current => {
      const currentById = new Map(current.map(e => [e.id, e]));
      let changed = current.length !== baseEdges.length;
      const nextEdges = baseEdges.map(next => {
        const existing = currentById.get(next.id);
        if (!existing) { changed = true; return next; }
        const same = existing.source === next.source && existing.target === next.target && existing.type === next.type && (existing as Edge & { selectable?: boolean }).selectable === (next as Edge & { selectable?: boolean }).selectable && existing.animated === next.animated;
        if (same) return existing;
        changed = true;
        return { ...existing, ...next };
      });
      return changed ? nextEdges : current;
    });
  }, [baseEdges, setEdges]);

  useEffect(() => {
    if (!focusId) return;
    const n = nodes.find(node => node.id === focusId);
    if (n) requestAnimationFrame(() => rf.setCenter(n.position.x + 115, n.position.y + 55, { zoom:1.05, duration:220 }));
  }, [focusId, nodes, rf]);

  useImperativeHandle(ref, () => ({
    fitView: () => rf.fitView({ padding:0.12, duration:220 }),
    zoomIn: () => rf.zoomIn({ duration:160 }),
    zoomOut: () => rf.zoomOut({ duration:160 }),
    resetViewport: () => rf.setViewport({ x:0, y:0, zoom:1 }, { duration:220 }),
    focus: (id:string) => { const n=nodes.find(node=>node.id===id); if(n) rf.setCenter(n.position.x+115,n.position.y+55,{zoom:1.05,duration:220}); },
  }), [nodes, rf, ref]);

  const handleConnect = useCallback((connection:Connection) => {
    if (locked || !connection.source || !connection.target || connection.source === connection.target) return;
    const next = addEdge({ ...connection, id:`e-${crypto.randomUUID()}`, type:'default', pathOptions:{ curvature:0.28 }, style:{ stroke:'hsl(217 88% 62%)', strokeWidth:2.4 } }, edgesRef.current);
    setEdges(next);
    onCanvasStateChange({ connections:next });
  }, [locked, onCanvasStateChange, setEdges]);

  const handleNodesChange = useCallback((changes:any[]) => {
    onNodesChange(changes);
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes:any[]) => {
    onEdgesChange(changes);
    const deleted = changes.filter(c => c.type === 'remove').map(c => c.id);
    if (deleted.length) {
      const next = edgesRef.current.filter(e => !deleted.includes(e.id));
      onCanvasStateChange({ connections:next });
    }
  }, [onCanvasStateChange, onEdgesChange]);

  const handleNodeDragStop = useCallback((_:React.MouseEvent, node:CanvasNode) => {
    if (locked) return;
    if (node.data.topic) onCanvasStateChange({ topicPositions:{ [node.id]:node.position } });
    if (node.data.element) onCanvasStateChange({ elementPositions:{ [node.id]:node.position } });
  }, [locked, onCanvasStateChange]);

  const handleMoveEnd = useCallback((_:unknown, v:{x:number;y:number;zoom:number}) => onCanvasStateChange({ viewport:v }), [onCanvasStateChange]);
  const handleDrop = useCallback((event:React.DragEvent) => {
    event.preventDefault();
    if (locked) return;
    const kind = event.dataTransfer.getData('application/roadmap-kind') as EditorElement['kind'];
    if (!kind) return;
    onAddElementAt(kind, rf.screenToFlowPosition({ x:event.clientX, y:event.clientY }));
  }, [locked, onAddElementAt, rf]);

  return (
    <div className="studio-canvas" onDrop={handleDrop} onDragOver={e=>e.preventDefault()}>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange} onEdgesChange={handleEdgesChange} onConnect={handleConnect}
        onNodeClick={(_,n)=>onSelect(n.id)} onNodeDoubleClick={(_,n)=>onSelect(n.id)}
        onEdgeClick={(_,e)=>onSelect(e.id)} onPaneClick={()=>onSelect('')}
        onNodeDragStop={handleNodeDragStop} onMoveEnd={handleMoveEnd}
        defaultEdgeOptions={{ type:'default', pathOptions:{ curvature:0.28 }, style:{ stroke:'hsl(217 88% 62%)', strokeWidth:2.4 } } as any}
        nodesConnectable={!locked} nodesDraggable={!locked} elementsSelectable zoomOnScroll zoomOnPinch panOnDrag
        minZoom={0.2} maxZoom={2.5} fitView={false} deleteKeyCode={null} proOptions={{ hideAttribution:true }}
      >
        <Background gap={20} size={1} color="hsl(220 20% 90%)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={n=>topics.some(t=>t.id===n.id)?'#6675F2':'#94a3b8'} />
      </ReactFlow>
      {locked && showLockBadge && <div className="studio-canvas-lock">Read-only canvas</div>}
      {!nodes.length && <div className="studio-empty-overlay"><div className="studio-empty-icon"><Network size={24}/></div><h3>Start designing your roadmap</h3><p>Add a title or legend, create topics, then connect the tree visually.</p></div>}
    </div>
  );
}), (a,b) => (
  a.roadmapId===b.roadmapId && a.topics===b.topics && a.elements===b.elements && a.topicPositions===b.topicPositions &&
  a.topicColors===b.topicColors && a.connections===b.connections && a.viewport===b.viewport && a.search===b.search &&
  a.locked===b.locked && a.showLockBadge===b.showLockBadge && a.focusId===b.focusId && a.selectedId===b.selectedId && a.onSelect===b.onSelect && a.onAddChild===b.onAddChild &&
  a.onManageResources===b.onManageResources && a.onCanvasStateChange===b.onCanvasStateChange && a.onAddElementAt===b.onAddElementAt && a.onUpdateElement===b.onUpdateElement && a.onResizeElement===b.onResizeElement &&
  a.colorForTopic===b.colorForTopic && a.colorForElement===b.colorForElement
));


export type RoadmapVisualCanvasProps = {
  roadmapId: string;
  topics: StudioTopic[];
  editorState?: {
    elements?: EditorElement[];
    topicPositions?: Record<string, {x:number;y:number}>;
    topicColors?: Record<string,string>;
    connections?: Edge[];
    viewport?: {x:number;y:number;zoom:number};
  };
  search?: string;
  selectedId?: string | null;
  locked?: boolean;
  onSelect?: (id:string) => void;
  showLockBadge?: boolean;
};

const VISUAL_COLORS = [
  { id:'indigo', bg:'#E8EEFF', border:'#6675F2', text:'#1E2752', dot:'#5B67D8' },
  { id:'violet', bg:'#EEE9FF', border:'#8A63D2', text:'#38245F', dot:'#7C3AED' },
  { id:'sky', bg:'#E3F3FF', border:'#4E9BD6', text:'#183B56', dot:'#2F7EC5' },
  { id:'mint', bg:'#E4F7EE', border:'#4AAE7A', text:'#173F2C', dot:'#2E8B57' },
  { id:'peach', bg:'#FFF0E3', border:'#E39A64', text:'#5A2E19', dot:'#D97745' },
  { id:'rose', bg:'#FCE8F1', border:'#D979A4', text:'#5B243B', dot:'#C85A8C' },
  { id:'slate', bg:'#EEF2F6', border:'#718096', text:'#26323F', dot:'#5B6775' },
  { id:'gold', bg:'#FFF7D6', border:'#C9A227', text:'#4E3F06', dot:'#B78A00' },
] as const;

function visualColor(id?: string) {
  const preset = VISUAL_COLORS.find(c=>c.id===id);
  if (preset) return preset;
  if (id && /^#[0-9a-f]{6}$/i.test(id)) return { id, bg:`${id}1A`, border:id, text:'#1F2937', dot:id };
  return VISUAL_COLORS[0];
}
function visualDefaultColor(topic: StudioTopic, topics: StudioTopic[]) {
  let depth=0, current: StudioTopic|undefined=topic;
  while(current?.parentId){ depth++; current=topics.find(t=>t.id===current!.parentId); if(depth>20) break; }
  if(depth<=1) return 'gold';
  if(depth<=3) return 'peach';
  return 'slate';
}
function visualDefaults(topics: StudioTopic[], state: RoadmapVisualCanvasProps['editorState']) {
  const positions={...(state?.topicPositions||{})};
  const colors={...(state?.topicColors||{})};
  const children=new Map<string|null,StudioTopic[]>();
  topics.forEach(t=>children.set(t.parentId,[...(children.get(t.parentId)||[]),t]));
  children.forEach(a=>a.sort((x,y)=>(x.position ?? 0)-(y.position ?? 0)));
  const walk=(items:StudioTopic[],x:number,startY:number)=>{let cursor=startY; items.forEach(t=>{if(!positions[t.id])positions[t.id]={x,y:cursor}; const kids=children.get(t.id)||[]; if(kids.length)walk(kids,x+340,positions[t.id].y-((kids.length-1)*48)); cursor+=Math.max(145,kids.length*96+52);});};
  walk(children.get(null)||[],620,120);
  topics.forEach(t=>{if(!colors[t.id])colors[t.id]=visualDefaultColor(t,topics);});
  return {positions,colors};
}

/**
 * Canonical roadmap canvas used by Create, View, Share and Community.
 * Keeping this wrapper in one place guarantees the same nodes, positions,
 * colors, edges, controls, minimap and viewport everywhere.
 */
export function RoadmapVisualCanvas({roadmapId,topics,editorState,search='',selectedId=null,locked=true,onSelect=()=>{},showLockBadge=false}:RoadmapVisualCanvasProps) {
  const normalized=useMemo(()=>visualDefaults(topics,editorState),[topics,editorState]);
  const noop=useCallback(()=>{},[]);
  const noopState=useCallback(()=>{},[]);
  const addElement=useCallback(()=>{},[]);
  const colorForTopic=useCallback((topic:StudioTopic)=>visualColor(normalized.colors[topic.id]),[normalized.colors]);
  const colorForElement=useCallback((element:EditorElement)=>visualColor(element.color),[]);
  return <ReactFlowProvider><StudioCanvas
    roadmapId={roadmapId}
    topics={topics}
    elements={editorState?.elements||[]}
    topicPositions={normalized.positions}
    topicColors={normalized.colors}
    connections={editorState?.connections||[]}
    viewport={editorState?.viewport}
    search={search}
    locked={locked}
    showLockBadge={showLockBadge}
    selectedId={selectedId}
    onSelect={onSelect}
    onAddChild={noop}
    onManageResources={noop}
    onCanvasStateChange={noopState}
    onAddElementAt={addElement}
    colorForTopic={colorForTopic}
    colorForElement={colorForElement}
  /></ReactFlowProvider>;
}
