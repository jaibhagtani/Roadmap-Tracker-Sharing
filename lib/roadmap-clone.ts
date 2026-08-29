import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export type CloneSource = {
  id: string;
  title: string;
  description: string;
  editorState: unknown;
  topics: Array<{
    id: string;
    parentId: string | null;
    title: string;
    description: string;
    notes: string;
    status: any;
    progress: number;
    priority: number;
    position: number;
    tags: string[];
    dueDate: Date | null;
    resources: Array<{ title: string; url: string; type: string; notes: string; completed: boolean; favorite: boolean }>;
  }>;
  goals?: Array<{ title: string; description: string; deadline: Date | null; progress: number; status: any }>;
  todos?: Array<{ todoDate: Date; title: string; notes: string; completed: boolean; priority: number; position: number }>;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T;
}

/**
 * Creates a genuinely independent roadmap. Topic/layer IDs and editor element
 * IDs are regenerated and all internal references are remapped to the new IDs.
 */
export async function cloneRoadmap(tx: Prisma.TransactionClient, source: CloneSource, ownerId: string) {
  const roadmap = await tx.roadmap.create({
    data: {
      ownerId,
      title: `${source.title || 'Roadmap'} (Clone)`,
      description: source.description || '',
      privacy: 'private',
      editorState: {},
    },
  });

  const idMap = new Map<string, string>();
  const ordered = [...source.topics].sort((a, b) => {
    if ((a.parentId ?? '') === (b.parentId ?? '')) return a.position - b.position;
    return (a.parentId ?? '').localeCompare(b.parentId ?? '');
  });

  // Create parents before children. Positions remain exactly as authored.
  const pending = [...ordered];
  while (pending.length) {
    const index = pending.findIndex(t => t.parentId === null || idMap.has(t.parentId));
    if (index < 0) throw new Error('INVALID_ROADMAP_HIERARCHY');
    const old = pending.splice(index, 1)[0];
    const created = await tx.topic.create({
      data: {
        roadmapId: roadmap.id,
        parentId: old.parentId ? idMap.get(old.parentId)! : null,
        title: old.title,
        description: old.description || '',
        notes: old.notes || '',
        status: old.status,
        progress: old.progress ?? 0,
        priority: old.priority ?? 0,
        position: old.position ?? 0,
        tags: Array.isArray(old.tags) ? old.tags : [],
        dueDate: old.dueDate,
      },
    });
    idMap.set(old.id, created.id);
    for (const resource of old.resources || []) {
      await tx.resource.create({
        data: {
          topicId: created.id,
          title: resource.title,
          url: resource.url,
          type: resource.type || 'other',
          notes: resource.notes || '',
          completed: !!resource.completed,
          favorite: !!resource.favorite,
        },
      });
    }
  }

  for (const goal of source.goals || []) {
    await tx.goal.create({
      data: {
        ownerId,
        roadmapId: roadmap.id,
        title: goal.title,
        description: goal.description || '',
        deadline: goal.deadline,
        progress: goal.progress ?? 0,
        status: goal.status,
      },
    });
  }

  for (const todo of source.todos || []) {
    await tx.todo.create({
      data: {
        ownerId,
        roadmapId: roadmap.id,
        todoDate: todo.todoDate,
        title: todo.title,
        notes: todo.notes || '',
        completed: !!todo.completed,
        priority: todo.priority ?? 0,
        position: todo.position ?? 0,
      },
    });
  }

  const raw = cloneJson<any>(source.editorState || {});
  const elementIdMap = new Map<string, string>();
  const elements = Array.isArray(raw.elements)
    ? raw.elements.map((element: any) => {
        const nextId = randomUUID();
        if (element?.id) elementIdMap.set(String(element.id), nextId);
        return { ...element, id: nextId };
      })
    : [];

  const remapRef = (value: unknown) => {
    const key = typeof value === 'string' ? value : '';
    return idMap.get(key) || elementIdMap.get(key) || value;
  };

  const topicPositions: Record<string, unknown> = {};
  for (const [oldId, position] of Object.entries(raw.topicPositions || {})) {
    const nextId = idMap.get(oldId);
    if (nextId) topicPositions[nextId] = position;
  }

  const topicColors: Record<string, unknown> = {};
  for (const [oldId, color] of Object.entries(raw.topicColors || {})) {
    const nextId = idMap.get(oldId);
    if (nextId) topicColors[nextId] = color;
  }

  const connections = Array.isArray(raw.connections)
    ? raw.connections.map((edge: any) => ({
        ...edge,
        id: typeof edge.id === 'string' ? `edge-${randomUUID()}` : edge.id,
        source: remapRef(edge.source),
        target: remapRef(edge.target),
      }))
    : [];

  const editorState = {
    ...raw,
    elements,
    topicPositions,
    topicColors,
    connections,
  };

  await tx.roadmap.update({ where: { id: roadmap.id }, data: { editorState } });
  return { id: roadmap.id, title: roadmap.title, sourceId: source.id };
}
