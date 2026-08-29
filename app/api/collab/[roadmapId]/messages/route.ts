import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { errorResponse, withRls } from '@/lib/db';
import { getRoadmapRole } from '@/lib/collab-access';

const bodySchema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function GET(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const messages = await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role === 'none') throw new Error('FORBIDDEN');
      const rows = await tx.collaborationMessage.findMany({ where: { roadmapId }, orderBy: { createdAt: 'desc' }, take: 100 });
      const authorIds = [...new Set(rows.map((m: { authorId: string }) => m.authorId).filter(Boolean))];
      const users: Array<{ id: string; fullName: string; email: string }> = authorIds.length ? await tx.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, fullName: true, email: true } }) : [];
      const byId = new Map<string, { id: string; fullName: string; email: string }>(users.map(u => [u.id, u]));
      return rows.map((m: { authorId: string }) => ({ ...m, authorName: byId.get(m.authorId)?.fullName || byId.get(m.authorId)?.email || 'Team member' }));
    });
    return NextResponse.json({ messages: messages.reverse() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const { body } = bodySchema.parse(await req.json());
    const result = await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role === 'none') throw new Error('FORBIDDEN');
      const message = await tx.collaborationMessage.create({ data: { roadmapId, authorId: user.id, body } });
      return { message }; 
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
