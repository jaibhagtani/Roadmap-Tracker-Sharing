import { NextResponse, type NextRequest } from 'next/server';

const protectedPrefixes = ['/dashboard', '/roadmap', '/calendar', '/todos', '/notifications', '/templates', '/shared', '/collaborate', '/community', '/settings'];
const authPrefixes = ['/auth/login', '/auth/signup', '/auth/forgot', '/auth/reset'];
const cookieName = 'roadmap_session';

function base64urlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const raw = atob(normalized);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function isValidSessionToken(token: string) {
  const [body, sig] = token.split('.');
  const secret = process.env.AUTH_SECRET;
  if (!body || !sig || !secret) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, base64urlToBytes(sig), new TextEncoder().encode(body));
  if (!valid) return false;
  try {
    const raw = JSON.parse(new TextDecoder().decode(base64urlToBytes(body)));
    return !!raw?.sub && !!raw?.sid && Number(raw?.exp) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = protectedPrefixes.some(p => path === p || path.startsWith(`${p}/`));
  const isAuthPage = authPrefixes.some(p => path === p || path.startsWith(`${p}/`));
  const token = req.cookies.get(cookieName)?.value;
  const valid = token ? await isValidSessionToken(token) : false;

  if (isProtected && !valid) {
    const next = encodeURIComponent(`${path}${req.nextUrl.search}`);
    return NextResponse.redirect(new URL(`/auth/login?next=${next}`, req.url));
  }
  if (isAuthPage && valid && path !== '/auth/reset') return NextResponse.redirect(new URL('/dashboard', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*','/roadmap/:path*','/calendar/:path*','/todos/:path*','/notifications/:path*','/templates/:path*','/shared/:path*','/collaborate/:path*','/community/:path*','/settings/:path*','/auth/:path*'] };
