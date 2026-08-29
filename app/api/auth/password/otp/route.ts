import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { issueOtp } from '@/lib/otp';
export async function POST() { try { const user = await requireUser(); const row = await db.user.findUnique({ where: { id: user.id }, select: { email: true } }); if (!row) return NextResponse.json({ error: 'User not found.' }, { status: 404 }); await issueOtp(user.id, row.email, 'password'); return NextResponse.json({ ok: true, message: 'Password update OTP sent to your email.' }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to send password OTP.' }, { status: 400 }); } }
