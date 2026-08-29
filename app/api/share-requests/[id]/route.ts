import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { bumpUserCache } from '@/lib/redis';

const schema = z.object({ action: z.enum(['accept','reject']) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = schema.parse(await req.json());
    const result = await withRls(user.id, async tx => {
      const invite = await tx.shareRequest.findUnique({ where: { id } });
      if (!invite || (invite.receiverId !== user.id && invite.senderId !== user.id)) throw new Error('NOT_FOUND');
      if (invite.status !== 'pending') throw new Error('REQUEST_ALREADY_HANDLED');

      const isJoin = invite.requestType === 'join';
      const isLeader = isJoin && invite.receiverId === user.id;
      const isRecipient = !isJoin && invite.receiverId === user.id;
      if (!isLeader && !isRecipient) throw new Error('FORBIDDEN');

      if (input.action === 'accept') {
        const targetUserId = isJoin ? invite.senderId : invite.receiverId;
        if (invite.scopeType === 'roadmap' && invite.roadmapId) {
          await tx.roadmapShare.upsert({
            where: { roadmapId_userId: { roadmapId: invite.roadmapId, userId: targetUserId } },
            create: { roadmapId: invite.roadmapId, userId: targetUserId, role: invite.role === 'editor' ? 'contributor' : invite.role },
            update: { role: invite.role === 'editor' ? 'contributor' : invite.role },
          });
        } else if (invite.scopeType === 'topic' && invite.rootTopicId) {
          await tx.topicShare.upsert({
            where: { topicId_userId: { topicId: invite.rootTopicId, userId: targetUserId } },
            create: { topicId: invite.rootTopicId, userId: targetUserId, role: invite.role === 'editor' ? 'contributor' : invite.role },
            update: { role: invite.role === 'editor' ? 'contributor' : invite.role },
          });
        } else if (invite.scopeType === 'template' && invite.templateId) {
          await tx.templateShare.upsert({ where: { templateId_userId: { templateId: invite.templateId, userId: targetUserId } }, create: { templateId: invite.templateId, userId: targetUserId }, update: {} });
        }
      }

      const status = input.action === 'accept' ? 'accepted' : 'rejected';
      const updated = await tx.shareRequest.update({ where: { id }, data: { status } });
      const notifyUser = isJoin ? invite.senderId : invite.senderId;
      await tx.notification.create({
        data: {
          userId: notifyUser,
          type: `share_request_${status}`,
          title: isJoin ? `Collaboration request ${status}` : `Share request ${status}`,
          body: isJoin
            ? (status === 'accepted' ? 'The roadmap leader accepted your collaboration request. You can now collaborate directly on the shared roadmap.' : 'The roadmap leader rejected your collaboration request.')
            : (status === 'accepted' ? 'The receiver accepted your share request.' : 'The receiver rejected your share request.'),
          shareRequestId: invite.id,
        },
      });
      return updated;
    });
    await bumpUserCache([user.id, result.senderId, result.receiverId]);
    return NextResponse.json({ shareRequest: result });
  } catch (e) { return errorResponse(e); }
}
