import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { detectResourceType } from '@/lib/url-type';
import { z } from 'zod';

const schema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  url: z.string().url().optional(),
  type: z.string().trim().min(1).max(50).nullable().optional(),
  notes: z.string().max(10000).optional(),
  completed: z.boolean().optional(),
  favorite: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const input = schema.parse(await req.json());
  const existing = await withRls(user.id, tx => tx.resource.findFirst({ where: { id, topic: { roadmap: { ownerId: user.id } } } }));
  if (!existing) return new Response('Not found', { status: 404 });
  const resource = await withRls(user.id, tx => tx.resource.update({
    where: { id },
    data: { ...input, type: input.type === null ? undefined : input.type ?? (input.url ? detectResourceType(input.url) : undefined) },
  }));
  return NextResponse.json({ resource });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const deleted = await withRls(user.id, tx => tx.resource.deleteMany({ where: { id, topic: { roadmap: { ownerId: user.id } } } }));
  if (!deleted.count) return new Response('Not found', { status: 404 });
  return NextResponse.json({ ok: true });
}
