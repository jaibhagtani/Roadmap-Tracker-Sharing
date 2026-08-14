import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { z } from 'zod';

const resourceSchema = z.object({ title: z.string().min(1).max(300), url: z.string().url(), type: z.string().max(50).optional(), notes: z.string().max(10000).optional(), completed: z.boolean().optional(), favorite: z.boolean().optional() });
const topicSchema: z.ZodType<any> = z.lazy(() => z.object({ title: z.string().min(1).max(200), description: z.string().max(5000).optional(), notes: z.string().max(50000).optional(), status: z.enum(['not_started','in_progress','completed']).optional(), progress: z.number().int().min(0).max(100).optional(), priority: z.number().int().min(0).max(5).optional(), tags: z.array(z.string().max(50)).optional(), dueDate: z.string().nullable().optional(), resources: z.array(resourceSchema).optional(), children: z.array(topicSchema).optional() }));
const todoSchema = z.object({ todoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().min(1).max(300), notes: z.string().max(5000).optional(), completed: z.boolean().optional(), position: z.number().int().min(0).optional() });
const payloadSchema = z.object({ roadmap: z.object({ title: z.string().min(1).max(200), description: z.string().max(5000).optional(), privacy: z.enum(['private','link','public']).optional() }), tree: z.array(topicSchema).max(5000), todos: z.array(todoSchema).optional(), dailyLogs: z.array(z.object({ logDate: z.string(), studyMinutes: z.number().int().min(0), topicsStudied: z.array(z.string()).optional(), resourcesCompleted: z.number().int().min(0).optional(), problemsSolved: z.number().int().min(0).optional(), learned: z.string().optional(), difficulties: z.string().optional(), tomorrowGoal: z.string().optional() })).optional() });

export async function POST(req: Request) {
  const user = await requireUser();
  const payload = payloadSchema.parse(await req.json());
  const result = await withRls(user.id, async tx => {
    const roadmap = await tx.roadmap.create({ data: { ownerId: user.id, title: payload.roadmap.title, description: payload.roadmap.description ?? '', privacy: 'private' } });
    async function insertNodes(nodes:any[], parentId:string|null) {
      let position = 0;
      for (const node of nodes) {
        const topic = await tx.topic.create({ data: { roadmapId: roadmap.id, parentId, title: node.title, description: node.description ?? '', notes: node.notes ?? '', status: node.status ?? 'not_started', progress: node.status === 'completed' ? 100 : node.progress ?? 0, priority: node.priority ?? 0, tags: node.tags ?? [], dueDate: node.dueDate ? new Date(node.dueDate) : null, position } });
        for (const resource of node.resources ?? []) await tx.resource.create({ data: { topicId: topic.id, title: resource.title, url: resource.url, type: resource.type ?? 'other', notes: resource.notes ?? '', completed: resource.completed ?? false, favorite: resource.favorite ?? false } });
        await insertNodes(node.children ?? [], topic.id);
        position += 1;
      }
    }
    await insertNodes(payload.tree, null);
    for (const log of payload.dailyLogs ?? []) await tx.dailyLog.upsert({ where: { ownerId_logDate: { ownerId: user.id, logDate: new Date(`${log.logDate.slice(0,10)}T00:00:00.000Z`) } }, create: { ownerId: user.id, logDate: new Date(`${log.logDate.slice(0,10)}T00:00:00.000Z`), studyMinutes: log.studyMinutes, topicsStudied: log.topicsStudied ?? [], resourcesCompleted: log.resourcesCompleted ?? 0, problemsSolved: log.problemsSolved ?? 0, learned: log.learned ?? '', difficulties: log.difficulties ?? '', tomorrowGoal: log.tomorrowGoal ?? '' }, update: { studyMinutes: log.studyMinutes, topicsStudied: log.topicsStudied ?? [], resourcesCompleted: log.resourcesCompleted ?? 0, problemsSolved: log.problemsSolved ?? 0, learned: log.learned ?? '', difficulties: log.difficulties ?? '', tomorrowGoal: log.tomorrowGoal ?? '' } });
    for (const todo of payload.todos ?? []) await tx.todo.create({ data: { ownerId: user.id, roadmapId: roadmap.id, todoDate: new Date(`${todo.todoDate.slice(0,10)}T00:00:00.000Z`), title: todo.title, notes: todo.notes ?? '', completed: todo.completed ?? false, position: todo.position ?? 0 } });
    return roadmap;
  });
  return NextResponse.json({ roadmap: result }, { status: 201 });
}
