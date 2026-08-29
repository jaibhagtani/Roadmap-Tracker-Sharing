'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return <div className="auth-page relative grid min-h-screen place-items-center overflow-hidden bg-[hsl(var(--background))] p-5"><div className="auth-orb auth-orb-a"/><div className="auth-orb auth-orb-b"/><div className="auth-grid"/><div className="relative w-full max-w-[420px]"><div className="mb-5 flex items-center justify-center gap-2 text-sm font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950">R</span><span>Roadmap</span></div><Card className="auth-card relative w-full p-7 sm:p-9"><div className="mb-7"><div className="mb-4 inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">Learning workspace</div><h1 className="text-[28px] font-bold tracking-[-.04em]">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p></div>{children}<div className="mt-6 border-t border-[hsl(var(--border))] pt-5 text-sm text-slate-500">{footer}</div></Card><p className="mt-5 text-center text-[11px] text-slate-400">Organize learning. Build momentum. Collaborate with confidence.</p></div></div>;
}
export function AuthMessage({ message, error }: { message: string; error?: boolean }) { if (!message) return null; return <p className={`mt-4 rounded-xl border px-3 py-2 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>{message}</p>; }
export function useNextPath() { const [nextPath,setNextPath]=useState('/dashboard'); useEffect(()=>{const next=new URLSearchParams(window.location.search).get('next'); if(next&&next.startsWith('/')) setNextPath(next);},[]); return nextPath; }
export const AuthLinks = ({ forgot = true }: { forgot?: boolean }) => <div className="flex items-center justify-between text-sm">{forgot ? <Link href="/auth/forgot" className="text-indigo-600 hover:underline">Forgot password?</Link> : <span/>}<Link href="/auth/signup" className="text-indigo-600 hover:underline">Create account</Link></div>;
export function GoogleButton(){return null;}
