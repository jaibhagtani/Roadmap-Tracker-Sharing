import { NextResponse } from 'next/server';
import { withRls, errorResponse } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const result = await withRls(user.id, async (tx: any) => {
      const invite = await tx.shareRequest.findFirst({
        where: { id, receiverId: user.id, status: { in: ['pending', 'accepted'] } },
        include: { roadmap: true, rootTopic: true, template: true },
      });
      if (!invite) throw new Error('NOT_FOUND');

      let rootNodes: any[] = [];
      let title = 'Cloned roadmap';
      let description = 'Cloned from a shared item.';

      if (invite.scopeType === 'template') {
        rootNodes = (invite.template?.tree as any[]) || [];
        title = `${invite.template?.name || 'Template'} (Clone)`;
        description = invite.template?.description || description;
      } else if (invite.roadmapId) {
        title = `${invite.roadmap?.title || 'Roadmap'} (Clone)`;
        description = invite.roadmap?.description || description;

        const topics = await tx.topic.findMany({
          where: { roadmapId: invite.roadmapId },
          include: { resources: true },
          orderBy: [{ parentId: 'asc' }, { position: 'asc' }],
        });

        if (invite.scopeType === 'roadmap') {
          rootNodes = topics.filter((t: any) => t.parentId === null).map((r: any) => mapNode(r, topics));
        } else {
          const root = topics.find((t: any) => t.id === invite.rootTopicId);
          if (!root) throw new Error('NOT_FOUND');
          rootNodes = [mapNode(root, topics)];
        }
      } else throw new Error('NOT_FOUND');

      const roadmap = await tx.roadmap.create({ data: { ownerId: user.id, title, description, privacy: 'private' } });

      async function add(nodes: any[], parentId: string | null) {
        let position = 0;
        for (const node of nodes) {
          const topic = await tx.topic.create({
            data: {
              roadmapId: roadmap.id,
              parentId,
              title: String(node.title),
              description: String(node.description || ''),
              notes: String(node.notes || ''),
              status: node.status === 'completed' ? 'completed' : 'not_started',
              progress: Number(node.progress || 0),
              priority: Number(node.priority || 0),
              tags: Array.isArray(node.tags) ? node.tags.map(String) : [],
              dueDate: node.dueDate ? new Date(node.dueDate) : null,
              position,
            },
          });
          position++;

          for (const r of (node.resources || [])) {
            await tx.resource.create({ data: { topicId: topic.id, title: String(r.title), url: String(r.url), type: String(r.type || 'other'), notes: String(r.notes || ''), completed: !!r.completed, favorite: !!r.favorite } });
          }

          if (node.children && node.children.length) {
            await add(node.children, topic.id);
          }
        }
      }

      await add(rootNodes, null);
      return { ok: true, roadmapId: roadmap.id };
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

function mapNode(root: any, topics: any[]): any {
  const kids = topics.filter((t: any) => t.parentId === root.id).sort((a: any, b: any) => a.position - b.position);
  return { ...root, children: kids.map((k: any) => mapNode(k, topics)) };
}
