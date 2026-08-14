import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { z } from 'zod';

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  privacy: z.enum(['private', 'link', 'public']).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const roadmap = await withRls(user.id, tx => tx.roadmap.findFirst({
    where: { id, ownerId: user.id },
    include: { topics: { orderBy: [{ parentId: 'asc' }, { position: 'asc' }], include: { resources: { orderBy: { createdAt: 'asc' } } } } },
  }));
  if (!roadmap) return new Response('Not found', { status: 404 });
  return NextResponse.json({ roadmap });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const input = updateSchema.parse(await req.json());
  const roadmap = await withRls(user.id, tx => tx.roadmap.findFirst({ where: { id, ownerId: user.id } }));
  if (!roadmap) return new Response('Not found', { status: 404 });
  const updated = await withRls(user.id, tx => tx.roadmap.update({ where: { id }, data: input }));
  return NextResponse.json({ roadmap: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const deleted = await withRls(user.id, tx => tx.roadmap.deleteMany({ where: { id, ownerId: user.id } }));
  if (!deleted.count) return new Response('Not found', { status: 404 });
  return NextResponse.json({ ok: true });
}
