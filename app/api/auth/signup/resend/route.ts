import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { issueOtp } from '@/lib/otp';
const schema = z.object({ userId: z.string().uuid() });
export async function POST(req: Request) { try { const { userId } = schema.parse(await req.json()); const user = await db.user.findUnique({ where: { id: userId } }); if (!user || user.emailVerifiedAt) return NextResponse.json({ error: 'Verification is not available.' }, { status: 400 }); await issueOtp(user.id, user.email, 'signup'); return NextResponse.json({ ok: true, message: 'A new verification code was sent.' }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to resend code.' }, { status: 400 }); } }
