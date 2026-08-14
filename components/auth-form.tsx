'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-[hsl(var(--bg))] p-5"><Card className="w-full max-w-md p-7 sm:p-8"><div className="mb-7"><div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--accent))] font-bold text-white">R</div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{children}<div className="mt-5 text-sm text-slate-500">{footer}</div></Card></div>;
}
export function AuthMessage({ message, error }: { message: string; error?: boolean }) { if (!message) return null; return <p className={`mt-4 rounded-xl border px-3 py-2 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>{message}</p>; }
export function useNextPath() { const [nextPath,setNextPath]=useState('/dashboard'); useEffect(()=>{const next=new URLSearchParams(window.location.search).get('next'); if(next&&next.startsWith('/')) setNextPath(next);},[]); return nextPath; }
export const AuthLinks = ({ forgot = true }: { forgot?: boolean }) => <div className="flex items-center justify-between text-sm">{forgot ? <Link href="/auth/forgot" className="text-indigo-600 hover:underline">Forgot password?</Link> : <span/>}<Link href="/auth/signup" className="text-indigo-600 hover:underline">Create account</Link></div>;
export function GoogleButton(){return null;}
