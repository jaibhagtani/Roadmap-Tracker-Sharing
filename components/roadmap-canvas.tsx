'use client';

import { useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node as FlowNode,
} from 'reactflow';
import { ChevronDown, ChevronRight, CircleCheck, MoreHorizontal, Plus } from 'lucide-react';
import 'reactflow/dist/style.css';

export type CanvasTopic = {
  id: string;
  parentId: string | null;
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number;
  position: number;
  tags: string[];
  resources: { id: string; completed: boolean; favorite: boolean }[];
};

type TreeNode = CanvasTopic & { children: TreeNode[] };

type Props = {
  topics: CanvasTopic[];
  selectedId: string | null;
  expanded: Record<string, boolean>;
  canEdit: boolean;
  searchTerm: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAddChild: (id: string) => void;
};

function treeify(topics: CanvasTopic[]) {
  const map = new Map<string, TreeNode>();
  topics.forEach((t) => map.set(t.id, { ...t, children: [] }));
  const roots: TreeNode[] = [];
  topics.forEach((t) => {
    const node = map.get(t.id)!;
    if (t.parentId && map.has(t.parentId)) map.get(t.parentId)!.children.push(node);
    else roots.push(node);
  });
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

function filterTree(nodes: TreeNode[], term: string) {
  if (!term.trim()) return nodes;
  const query = term.trim().toLowerCase();
  const walk = (node: TreeNode): TreeNode | null => {
    const own = `${node.title} ${node.description} ${node.tags.join(' ')}`.toLowerCase().includes(query);
    const children = node.children.map(walk).filter(Boolean) as TreeNode[];
    return own || children.length ? { ...node, children } : null;
  };
  return nodes.map(walk).filter(Boolean) as TreeNode[];
}

type Positioned = { node: TreeNode; x: number; y: number };

function layoutTree(roots: TreeNode[], expanded: Record<string, boolean>) {
  const positioned: Positioned[] = [];
  let leafCursor = 0;
  const X_GAP = 320;
  const Y_GAP = 170;
  const visibleChildren = (node: TreeNode) => expanded[node.id] !== false ? node.children : [];

  const place = (node: TreeNode, depth: number) => {
    const children = visibleChildren(node);
    if (!children.length) {
      const x = leafCursor++ * X_GAP;
      positioned.push({ node, x, y: depth * Y_GAP });
      return x;
    }
    children.forEach((child) => place(child, depth + 1));
    const xs = children.map((child) => positioned.find((p) => p.node.id === child.id)?.x ?? 0);
    const x = xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
    positioned.push({ node, x, y: depth * Y_GAP });
    return x;
  };

  roots.forEach((root) => place(root, 0));
  return positioned.map(({ node, x, y }) => ({ node, position: { x: x - 115, y } }));
}

function statusClass(status: CanvasTopic['status']) {
  if (status === 'completed') return 'canvas-node-complete';
  if (status === 'in_progress') return 'canvas-node-progress';
  return 'canvas-node-idle';
}

function TopicNode({ data }: { data: any }) {
  const t = data.topic as CanvasTopic;
  const selected = data.selectedId === t.id;
  const resourceDone = t.resources.filter((r) => r.completed).length;

  return (
    <div className={`roadmap-node ${statusClass(t.status)} ${selected ? 'roadmap-node-selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="!border-2 !border-white !bg-slate-300" />
      <div className="roadmap-node-topline">
        <button type="button" className="roadmap-node-title" onClick={() => data.onSelect(t.id)} title={t.title}>
          {t.status === 'completed' && <CircleCheck size={15} className="shrink-0" />}
          <span className="truncate">{t.title}</span>
        </button>
        {data.canEdit && (
          <button type="button" className="roadmap-node-menu nodrag" onClick={() => data.onSelect(t.id)} title="Open topic options">
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>

      <button type="button" className="roadmap-node-body nodrag" onClick={() => data.onSelect(t.id)}>
        {t.description
          ? <p className="roadmap-node-description">{t.description}</p>
          : <p className="roadmap-node-description muted">Open to add notes and resources.</p>}
        <div className="roadmap-node-meta">
          <span>{t.progress}%</span>
          <span>{resourceDone}/{t.resources.length} resources</span>
          <span>{t.tags.length ? `${t.tags.length} tags` : 'No tags'}</span>
        </div>
        <div className="roadmap-node-progress"><span style={{ width: `${Math.max(0, Math.min(100, t.progress))}%` }} /></div>
      </button>

      <div className="roadmap-node-actions nodrag">
        <button type="button" onClick={() => data.onSelect(t.id)} className="roadmap-node-action">Open</button>
        {data.hasChildren && (
          <button type="button" onClick={() => data.onToggle(t.id)} className="roadmap-node-action">
            {data.expanded[t.id] !== false ? <><ChevronDown size={13}/> Collapse</> : <><ChevronRight size={13}/> Expand</>}
          </button>
        )}
        {data.canEdit && (
          <button type="button" onClick={() => data.onAddChild(t.id)} className="roadmap-node-action primary"><Plus size={13}/> Add</button>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!border-2 !border-white !bg-indigo-500" />
    </div>
  );
}

const nodeTypes = { topic: TopicNode };

function CanvasInner({ props }: { props: Props }) {
  const roots = useMemo(() => filterTree(treeify(props.topics), props.searchTerm), [props.topics, props.searchTerm]);
  const positioned = useMemo(() => layoutTree(roots, props.expanded), [roots, props.expanded]);

  const nodes = useMemo<FlowNode[]>(() => positioned.map(({ node, position }) => ({
    id: node.id,
    type: 'topic',
    position,
    draggable: false,
    data: {
      topic: node,
      selectedId: props.selectedId,
      expanded: props.expanded,
      canEdit: props.canEdit,
      hasChildren: node.children.length > 0,
      onSelect: props.onSelect,
      onToggle: props.onToggle,
      onAddChild: props.onAddChild,
    },
  })), [positioned, props.selectedId, props.expanded, props.canEdit, props.onSelect, props.onToggle, props.onAddChild]);

  const visibleIds = useMemo(() => new Set(positioned.map((p) => p.node.id)), [positioned]);
  const edges = useMemo<Edge[]>(() => positioned.flatMap(({ node }) => {
    if (node.parentId && visibleIds.has(node.parentId)) {
      return [{
        id: `${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id,
        type: 'smoothstep',
        animated: node.status === 'in_progress',
        style: { strokeWidth: 2 },
      }];
    }
    return [];
  }), [positioned, visibleIds]);

  return (
    <div className="roadmap-canvas-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, minZoom: 0.45, maxZoom: 1.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        minZoom={0.22}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => props.onSelect(node.id)}
        className="roadmap-canvas"
      >
        <Background gap={22} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(node) => node.id === props.selectedId ? '#4f46e5' : '#94a3b8'} />
        <div className="roadmap-canvas-hint">
          {props.searchTerm ? `${positioned.length} matching nodes` : `${props.topics.length} nodes · drag the canvas to explore`}
        </div>
      </ReactFlow>
    </div>
  );
}

export function RoadmapCanvas(props: Props) {
  return <ReactFlowProvider><CanvasInner props={props} /></ReactFlowProvider>;
}
