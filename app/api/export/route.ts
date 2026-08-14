import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';

function buildTree(topics: any[]) {
  const map = new Map<string, any>(topics.map(t => [t.id, { id: t.id, parentId: t.parentId, title: t.title, description: t.description, notes: t.notes, status: t.status, progress: t.progress, priority: t.priority, position: t.position, tags: t.tags, dueDate: t.dueDate, resources: t.resources.map((r:any) => ({ title: r.title, url: r.url, type: r.type, notes: r.notes, completed: r.completed, favorite: r.favorite })), children: [] }]));
  const roots: any[] = [];
  for (const topic of topics) {
    const node: any = map.get(topic.id);
    if (topic.parentId && map.has(topic.parentId)) {
      const parent = map.get(topic.parentId);
      if (parent) parent.children.push(node);
    } else roots.push(node);
  }
  const sort = (nodes:any[]) => { nodes.sort((a,b) => a.position - b.position); nodes.forEach(n => sort(n.children)); };
  sort(roots);
  return roots;
}

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const roadmapId = searchParams.get('roadmapId');
  const format = searchParams.get('format') ?? 'json';
  const data = await withRls(user.id, async tx => {
    const roadmap = await tx.roadmap.findFirst({ where: roadmapId ? { id: roadmapId, ownerId: user.id } : { ownerId: user.id }, orderBy: { updatedAt: 'desc' } });
    if (!roadmap) throw new Error('NOT_FOUND');
    const topics = await tx.topic.findMany({ where: { roadmapId: roadmap.id }, include: { resources: true }, orderBy: [{ position: 'asc' }] });
    const logs = await tx.dailyLog.findMany({ where: { ownerId: user.id }, orderBy: { logDate: 'asc' } });
    const todos = await tx.todo.findMany({ where: { ownerId: user.id }, orderBy: [{ todoDate: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] });
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      roadmap: { title: roadmap.title, description: roadmap.description, privacy: roadmap.privacy, shareSlug: roadmap.shareSlug },
      tree: buildTree(topics),
      dailyLogs: logs,
      todos,
    };
  });

  if (format === 'markdown') {
    const lines = [`# ${data.roadmap.title}`, '', data.roadmap.description, ''];
    const walk = (nodes:any[], depth = 0) => nodes.forEach(n => { lines.push(`${'#'.repeat(Math.min(depth + 2, 6))} ${n.title}`); if (n.description) lines.push(n.description); if (n.notes) lines.push(n.notes); n.resources.forEach((r:any) => lines.push(`- [${r.completed ? 'x' : ' '}] [${r.title}](${r.url})`)); lines.push(''); walk(n.children, depth + 1); });
    walk(data.tree);
    return new NextResponse(lines.join('\n'), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${data.roadmap.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md"` } });
  }
  return NextResponse.json(data, { headers: { 'Content-Disposition': `attachment; filename="roadmap-${roadmapId ?? 'latest'}.json"` } });
}
