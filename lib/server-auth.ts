import { cookies } from 'next/headers';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';

const COOKIE_NAME = 'roadmap_session';
const SESSION_DAYS = 30;

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Buffer.from(normalized, 'base64');
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters.');
  return value;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${base64url(salt)}.${base64url(derived)}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [saltB64, hashB64] = encoded.split('.');
  if (!saltB64 || !hashB64) return false;
  const actual = scryptSync(password, fromBase64url(saltB64), 64);
  const expected = fromBase64url(hashB64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function signToken(payload: { sub: string; sid: string; exp: number }) {
  const body = base64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret()).update(body).digest();
  return `${body}.${base64url(sig)}`;
}

export function verifyToken(token: string) {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = base64url(createHmac('sha256', secret()).update(body).digest());
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(fromBase64url(body).toString('utf8')) as { sub: string; sid: string; exp: number };
    if (!payload.sub || !payload.sid || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export async function createSession(userId: string) {
  const sid = randomBytes(18).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const token = signToken({ sub: userId, sid, exp });
  await db.session.create({ data: { id: sid, userId, tokenHash: tokenHash(token), expiresAt: new Date(exp * 1000) } });
  return { token, expiresAt: new Date(exp * 1000) };
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    const payload = verifyToken(token);
    if (payload) await db.session.deleteMany({ where: { id: payload.sid } });
  }
  jar.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: new Date(0) });
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const session = await db.session.findUnique({ where: { id: payload.sid }, include: { user: true } });
  if (!session || session.userId !== payload.sub || session.expiresAt < new Date() || session.tokenHash !== tokenHash(token)) return null;
  return { id: session.user.id, email: session.user.email, fullName: session.user.fullName };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Response('Unauthorized', { status: 401 });
  return user;
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_DAYS_COUNT = SESSION_DAYS;
