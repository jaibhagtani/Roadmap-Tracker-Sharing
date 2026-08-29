import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';

const schema = z.object({ q: z.string().trim().min(2).max(120) });

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const query = schema.parse({ q: new URL(req.url).searchParams.get('q') || '' }).q.toLowerCase();
    const users = await withRls(user.id, tx => tx.user.findMany({
      where: {
        id: { not: user.id },
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true, fullName: true },
      orderBy: { fullName: 'asc' },
      take: 20,
    }));
    return NextResponse.json({ users });
  } catch (e) { return errorResponse(e); }
}
