import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls } from '@/lib/db';

const schema = z.object({ message: z.string().max(1000).default('') });

export async function POST(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));
    const result = await withRls(user.id, async tx => {
      const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { id: true, ownerId: true, title: true, privacy: true } });
      if (!roadmap) throw new Error('NOT_FOUND');
      if (roadmap.ownerId === user.id) throw new Error('Cannot request your own roadmap');
      if (roadmap.privacy === 'private') throw new Error('ROADMAP_PRIVATE');
      // Public roadmap links are view-only. Collaboration requests for public
      // community/team workspaces go through the existing group request flow.
      if (roadmap.privacy === 'public') throw new Error('PUBLIC_VIEW_ONLY');
      const existing = await tx.roadmapShare.findUnique({ where: { roadmapId_userId: { roadmapId, userId: user.id } } });
      if (existing) throw new Error('ALREADY_MEMBER');
      const pending = await tx.shareRequest.findFirst({ where: { roadmapId, senderId: user.id, receiverId: roadmap.ownerId, requestType: 'join', status: 'pending' } });
      if (pending) return pending;
      const request = await tx.shareRequest.create({ data: {
        roadmapId, senderId: user.id, receiverId: roadmap.ownerId, requestType: 'join', scopeType: 'roadmap', role: 'contributor', message: body.message || `${user.email} wants to collaborate on “${roadmap.title}”.`
      } });
      await tx.notification.create({ data: { userId: roadmap.ownerId, type: 'collab_join_request', title: 'Collaboration request', body: `${user.email} requested to collaborate on “${roadmap.title}”.`, shareRequestId: request.id } });
      return request;
    });
    return NextResponse.json({ request: result }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected server error';
    const status = message === 'NOT_FOUND' ? 404 : ['ROADMAP_PRIVATE','PUBLIC_VIEW_ONLY','ALREADY_MEMBER'].includes(message) ? 409 : message === 'Cannot request your own roadmap' ? 400 : 400;
    return new Response(message, { status });
  }
}
