import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { getCached, setCached, userCacheKey, bumpUserCache } from '@/lib/redis';

export async function GET() {
  const user = await requireUser();
  const key = await userCacheKey(user.id, 'profile');
  const cached = await getCached<any>(key);
  if (cached) return NextResponse.json(cached);
  const profile = await withRls(user.id, async tx => tx.profile.upsert({
    where: { id: user.id },
    create: { id: user.id, fullName: user.fullName || user.email.split('@')[0], avatarUrl: '' },
    update: {},
  }));
  const payload = { user: { id: user.id, email: user.email }, profile };
  await setCached(key, payload, 60);
  return NextResponse.json(payload);
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const profile = await withRls(user.id, async tx => tx.profile.upsert({
    where: { id: user.id },
    create: { id: user.id, fullName: String(body.fullName ?? ''), avatarUrl: String(body.avatarUrl ?? ''), bio: String(body.bio ?? '') },
    update: { fullName: String(body.fullName ?? ''), avatarUrl: String(body.avatarUrl ?? ''), bio: String(body.bio ?? '') },
  }));
  await bumpUserCache(user.id);
  return NextResponse.json({ profile });
}
