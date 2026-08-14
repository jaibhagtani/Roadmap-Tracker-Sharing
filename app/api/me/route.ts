import { NextResponse } from 'next/server';
import { db, withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';

export async function GET() {
  const user = await requireUser();
  const profile = await withRls(user.id, async tx => tx.profile.upsert({
    where: { id: user.id },
    create: { id: user.id, fullName: user.fullName || user.email.split('@')[0], avatarUrl: '' },
    update: {},
  }));
  return NextResponse.json({ user: { id: user.id, email: user.email }, profile });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const profile = await withRls(user.id, async tx => tx.profile.upsert({
    where: { id: user.id },
    create: { id: user.id, fullName: String(body.fullName ?? ''), avatarUrl: String(body.avatarUrl ?? ''), bio: String(body.bio ?? '') },
    update: { fullName: String(body.fullName ?? ''), avatarUrl: String(body.avatarUrl ?? ''), bio: String(body.bio ?? '') },
  }));
  return NextResponse.json({ profile });
}
