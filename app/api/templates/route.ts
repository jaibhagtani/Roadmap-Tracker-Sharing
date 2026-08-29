import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { getCached, setCached, publicCacheKey, bumpUserCache } from '@/lib/redis';

export async function GET() {
  const user = await requireUser();
  const key = publicCacheKey('templates');
  const cached = await getCached<any[]>(key);
  if (cached) return NextResponse.json({ templates: cached, cached: true });
  const templates = await withRls(user.id, tx => tx.template.findMany({ orderBy: { name: 'asc' } }));
  await setCached(key, templates, 120);
  return NextResponse.json({ templates, cached: false });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const template = await withRls(user.id, tx => tx.template.findUnique({ where: { id: String(body.templateId) } }));
  if (!template) return new Response('Template not found', { status: 404 });
  const roadmap = await withRls(user.id, async tx => {
    const created = await tx.roadmap.create({ data: { ownerId: user.id, title: template.name, description: template.description, privacy: 'private' } });
    async function add(nodes: any[], parentId: string | null) {
      let position = 0;
      for (const node of nodes) {
        const topic = await tx.topic.create({ data: { roadmapId: created.id, parentId, title: String(node.title), description: String(node.description ?? ''), notes: String(node.notes ?? ''), status: 'not_started', progress: 0, priority: 0, tags: [], position } });
        position += 1;
        await add(Array.isArray(node.children) ? node.children : [], topic.id);
      }
    }
    await add(template.tree as any[], null);
    return created;
  });
  await bumpUserCache(user.id);
  return NextResponse.json({ roadmap }, { status: 201 });
}
