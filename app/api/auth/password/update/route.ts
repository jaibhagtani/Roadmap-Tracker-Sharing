import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, requireUser } from '@/lib/server-auth';
import { verifyOtp } from '@/lib/otp';
const schema = z.object({ otp: z.string().regex(/^\d{6}$/), password: z.string().min(8) });
export async function POST(req: Request) { try { const user = await requireUser(); const { otp, password } = schema.parse(await req.json()); const result = await verifyOtp(user.id, otp); if (!result.ok) return NextResponse.json({ error: result.reason === 'locked' ? 'Too many incorrect attempts. Request a new code.' : result.reason === 'expired' ? 'Code expired. Request a new code.' : 'Invalid OTP.' }, { status: 400 }); await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } }); return NextResponse.json({ ok: true, message: 'Password updated successfully.' }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to update password.' }, { status: 400 }); } }
