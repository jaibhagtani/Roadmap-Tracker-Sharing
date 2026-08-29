import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/server-auth';
import { issueOtp } from '@/lib/otp';

const schema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().email(), password: z.string().min(8) });

export async function POST(req: Request) {
  try {
    const i = schema.parse(await req.json());
    const email = i.email.toLowerCase();
    let user = await db.user.findUnique({ where: { email } });
    if (user?.emailVerifiedAt) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    if (!user) {
      user = await db.user.create({ data: { email, fullName: i.name, passwordHash: hashPassword(i.password) } });
      await db.profile.upsert({ where: { id: user.id }, update: { fullName: i.name }, create: { id: user.id, fullName: i.name } });
    } else {
      user = await db.user.update({ where: { id: user.id }, data: { fullName: i.name, passwordHash: hashPassword(i.password) } });
      await db.profile.upsert({ where: { id: user.id }, update: { fullName: i.name }, create: { id: user.id, fullName: i.name } });
    }
    await issueOtp(user.id, user.email, 'signup');
    return NextResponse.json({ requiresOtp: true, userId: user.id, email: user.email, message: 'Verification code sent to your email.' }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to create account.' }, { status: 400 });
  }
}
