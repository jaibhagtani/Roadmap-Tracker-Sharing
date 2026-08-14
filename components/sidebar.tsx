'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {LayoutDashboard,GitBranch,CalendarDays,Library,Share2,Settings,Sun,Search,Plus,LogOut} from 'lucide-react';
import {Button} from './ui';

const items = [
	['Dashboard', '/dashboard', LayoutDashboard],
	['My Roadmap', '/roadmap', GitBranch],
	['Calendar', '/calendar', CalendarDays],
	['Templates', '/templates', Library],
	['Shared Roadmaps', '/shared', Share2],
	['Settings', '/settings', Settings],
] as const;

export function Sidebar(){
	const p = usePathname();

	function toggle(){
		document.documentElement.classList.toggle('dark');
		localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
	}

	return (
		<aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[hsl(var(--line))] bg-[hsl(var(--card))] p-4 lg:block">
			<div className="mb-6 flex items-center gap-2 px-2">
				<div className="grid h-8 w-8 place-items-center rounded-xl bg-[hsl(var(--accent))] text-white">R</div>
				<b className="text-lg">Roadmap</b>
			</div>

			<Button className="mb-4 w-full" onClick={()=>location.href='/roadmap'}>
				<Plus size={16}/> <span className="ml-2">New roadmap</span>
			</Button>

			<button className="mb-4 flex w-full items-center gap-2 rounded-xl border border-[hsl(var(--line))] px-3 py-2 text-sm text-slate-500"><Search size={16}/>Search <kbd className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">⌘K</kbd></button>

			<nav className="space-y-1">
				{items.map(([n,h,I]) => (
					<Link key={h} href={h} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${p===h ? 'bg-slate-100 font-semibold dark:bg-slate-800' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'}`}>
						<I size={17}/>
						{n}
					</Link>
				))}
			</nav>

			<button onClick={toggle} className="mt-5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Sun size={17}/>Theme toggle</button>

			<button onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});location.href='/auth/login'}} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><LogOut size={17}/>Logout</button>
		</aside>
	);
}
