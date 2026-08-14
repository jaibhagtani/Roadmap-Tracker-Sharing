import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { detectResourceType } from '@/lib/url-type';
import { z } from 'zod';

const schema = z.object({
  topicId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  url: z.string().url(),
  type: z.string().trim().min(1).max(50).optional(),
  notes: z.string().max(10000).default(''),
  completed: z.boolean().default(false),
  favorite: z.boolean().default(false),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const input = schema.parse(await req.json());
  const resource = await withRls(user.id, async tx => {
    const topic = await tx.topic.findFirst({ where: { id: input.topicId, roadmap: { ownerId: user.id } }, select: { id: true } });
    if (!topic) throw new Error('NOT_FOUND');
    return tx.resource.create({ data: { ...input, type: input.type || detectResourceType(input.url) } });
  });
  return NextResponse.json({ resource }, { status: 201 });
}
