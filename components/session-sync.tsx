'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, ShieldAlert } from 'lucide-react';
import { installOfflineFetch } from '@/lib/offline-sync';

const SYNC_MS = Math.max(30_000, Number(process.env.NEXT_PUBLIC_APP_SYNC_MS || 180_000));
const INACTIVITY_MS = Math.max(60_000, Number(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS || 7_200_000));
const WARNING_MS = Math.min(Math.max(60_000, Number(process.env.NEXT_PUBLIC_INACTIVITY_WARNING_MS || 300_000)), INACTIVITY_MS - 60_000);
const ACTIVITY_KEY = 'roadmap:last-activity';
const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2,'0')}`; };

export function SessionSync() {
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(WARNING_MS);
  const [offline, setOffline] = useState(false);
  const warningRef = useRef(false);
  const warningText = useMemo(() => fmt(remaining), [remaining]);

  useEffect(() => {
    let active = true;
    let lastActivityWrite = 0;
    const markActivity = () => {
      if (warningRef.current) return;
      const now = Date.now();
      if (now - lastActivityWrite < 15_000) return;
      lastActivityWrite = now;
      try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch {}
    };
    const continueSession = () => {
      const now = Date.now();
      try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch {}
      lastActivityWrite = now;
      warningRef.current = false;
      setWarning(false);
      setRemaining(WARNING_MS);
    };
    const logout = async () => { if (!active) return; active = false; try { await fetch('/api/auth/logout', { method:'POST', keepalive:true }); } catch {} location.href = '/auth/login?reason=inactive'; };
    (window as any).__roadmapContinueSession = continueSession;
    const events = ['pointerdown','keydown','scroll','touchstart','mousemove']; events.forEach(n => window.addEventListener(n, markActivity, { passive:true }));
    const cleanupOffline = installOfflineFetch(); const setNet = () => setOffline(!navigator.onLine);
    window.addEventListener('online', setNet); window.addEventListener('offline', setNet); setNet();
    try {
      const raw = localStorage.getItem(ACTIVITY_KEY);
      const last = raw ? Number(raw) : 0;
      if (!Number.isFinite(last) || last <= 0 || last > Date.now()) {
        localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      }
    } catch {}
    const check = async () => {
      if (!active) return; 
      let last = Date.now();
      try {
        const stored = Number(localStorage.getItem(ACTIVITY_KEY) || 0);
        if (Number.isFinite(stored) && stored > 0) last = stored;
      } catch {}
      const age = Date.now() - last;
      if (age >= INACTIVITY_MS) return logout();
      const left = INACTIVITY_MS - age; if (left <= WARNING_MS) { warningRef.current = true; setWarning(true); setRemaining(left); } else { warningRef.current = false; setWarning(false); }
    };
    const syncTimer = window.setInterval(() => { void check(); }, SYNC_MS);
    const secondTimer = window.setInterval(() => { const last = Number(localStorage.getItem(ACTIVITY_KEY) || Date.now()); const age = Date.now() - last; const left = INACTIVITY_MS - age; if (left <= 0) void logout(); else if (left <= WARNING_MS) { setWarning(true); setRemaining(left); } }, 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void check();
    return () => {
      active = false;
      window.clearInterval(syncTimer);
      window.clearInterval(secondTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      events.forEach(n => window.removeEventListener(n, markActivity));
      window.removeEventListener('online', setNet);
      window.removeEventListener('offline', setNet);
      cleanupOffline();
      delete (window as any).__roadmapContinueSession;
    };
  }, []);

  return <>
    {offline && <div className="fixed bottom-4 left-4 z-[90] rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900 shadow-lg dark:border-amber-900/60 dark:bg-amber-950/80 dark:text-amber-100">Offline mode · changes are stored locally and will sync when you reconnect.</div>}
    {warning && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] p-6 shadow-2xl">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><ShieldAlert size={23}/></div>
        <h2 className="mt-4 text-center text-xl font-bold">Session ending due to inactivity</h2>
        <p className="mt-2 text-center text-sm leading-6 text-slate-500">Your session will end unless you continue. You have <b className="text-slate-900 dark:text-white">{warningText}</b> left.</p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500"><Clock3 size={14}/> Continue adds a fresh inactivity window.</div>
        <button onClick={() => (window as any).__roadmapContinueSession?.()} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700">Continue Session</button>
        <button onClick={() => void (async()=>{try{await fetch('/api/auth/logout',{method:'POST'})}catch{}location.href='/auth/login?reason=inactive'})()} className="mt-2 w-full rounded-xl border border-[hsl(var(--line))] px-4 py-3 text-sm font-medium">Log out now</button>
      </div>
    </div>}
  </>;
}
