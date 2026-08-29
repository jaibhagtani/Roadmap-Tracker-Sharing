'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, GitBranch, CalendarDays, Share2, Settings, Sun, Search, Plus, LogOut, Users } from 'lucide-react';
import { Button } from './ui';

const items = [
  ['Dashboard', '/dashboard', LayoutDashboard],
  ['My Roadmap', '/roadmap', GitBranch],
  ['Calendar', '/calendar', CalendarDays],
  ['Shared', '/shared', Share2],
  ['Community', '/community', Users],
  ['Collaboration', '/collaborate', Users],
  ['Settings', '/settings', Settings],
] as const;

export function Sidebar() {
  const p = usePathname();

  function toggle() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store' }); } catch {}
    window.location.assign('/auth/login');
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[hsl(var(--line))] bg-[hsl(var(--card))] lg:flex lg:flex-col">
        <div className="border-b border-[hsl(var(--line))] p-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">R</div>
            <div><div className="text-sm font-semibold">Roadmap</div><div className="text-[11px] text-slate-500">Learn. Build. Collaborate.</div></div>
          </Link>
        </div>

        <div className="p-4">
          <Button className="mb-3 w-full justify-center" onClick={() => location.href = '/roadmap'}><Plus size={16}/> New roadmap</Button>
          <button className="flex w-full items-center gap-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] px-3 py-2.5 text-sm text-slate-500 hover:text-inherit"><Search size={16}/> Search roadmap <kbd className="ml-auto rounded-md border border-[hsl(var(--line))] bg-[hsl(var(--card))] px-1.5 py-0.5 text-[10px]">⌘ K</kbd></button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Workspace</div>
          {items.slice(0, 7).map(([n, h, I]) => (
            <Link key={h} href={h} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${p === h ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/35 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'}`}>
              <I size={17} className={p === h ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 group-hover:text-slate-600'}/>{n}
              
            </Link>
          ))}
          <div className="mt-5 px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Account</div>
          <Link href="/settings" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${p === '/settings' ? 'bg-slate-100 font-semibold dark:bg-slate-800' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'}`}><Settings size={17}/>Settings</Link>
        </nav>

        <div className="border-t border-[hsl(var(--line))] p-3">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-900">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white">J</div>
            <div className="min-w-0"><div className="truncate font-medium">Your workspace</div><div className="truncate text-slate-500">Personal learning</div></div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button onClick={toggle} className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Sun size={15}/> Theme</button>
            <button onClick={logout} className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><LogOut size={15}/> Logout</button>
          </div>
        </div>
      </aside>

      <div className="fixed inset-x-0 top-0 z-40 border-b border-[hsl(var(--line))] bg-[hsl(var(--card))]/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white">R</Link>
          <nav className="scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {items.map(([n, h, I]) => (
              <Link key={h} href={h} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs ${p === h ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/35 dark:text-indigo-300' : 'text-slate-500'}`}><I size={14}/>{n}</Link>
            ))}
          </nav>
          <button onClick={toggle} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[hsl(var(--line))] text-slate-500" title="Theme"><Sun size={15}/></button>
        </div>
      </div>
    </>
  );
}
