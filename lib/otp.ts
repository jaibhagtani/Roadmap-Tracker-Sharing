import { createHash, randomInt } from 'node:crypto';
import { setUserOtp, consumeUserOtp, clearUserOtp } from '@/lib/redis';
import { sendOtpEmail } from '@/lib/mailer';

export function generateOtp() { return String(randomInt(100000, 1000000)); }
export function hashOtp(otp: string) { return createHash('sha256').update(otp).digest('hex'); }
export async function issueOtp(userId: string, email: string, purpose: 'signup' | 'password') {
  const otp = generateOtp();
  await setUserOtp(userId, hashOtp(otp));
  try { await sendOtpEmail(email, otp, purpose); }
  catch (error) { await clearUserOtp(userId); throw error; }
}
export async function verifyOtp(userId: string, otp: string) { return consumeUserOtp(userId, hashOtp(otp)); }
