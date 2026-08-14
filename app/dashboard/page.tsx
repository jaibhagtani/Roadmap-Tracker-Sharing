'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, Button } from '@/components/ui';

type Log={logDate:string;studyMinutes:number;resourcesCompleted:number;problemsSolved:number};
type Todo={id:string;ownerId:string;roadmapId:string|null;topicId:string|null;todoDate:string;title:string;notes:string;completed:boolean;position:number}

const iso=(d:Date)=>d.toISOString().slice(0,10);

export default function Dashboard(){
	const file=useRef<HTMLInputElement>(null);
	const[logs,setLogs]=useState<Log[]>([]);
	const[todos,setTodos]=useState<Todo[]>([]);
	const[stats,setStats]=useState<any>({currentStreak:0,activeDays:0,totalStudyMinutes:0});

	const today = useMemo(()=>{const d=new Date();d.setUTCHours(0,0,0,0);return iso(d)},[]);

	const days=useMemo(()=>{const end=new Date();end.setUTCHours(0,0,0,0);const start=new Date(end);start.setUTCDate(start.getUTCDate()-364);const a:Date[]=[];for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1))a.push(new Date(d));return a},[]);

	useEffect(()=>{const load=async()=>{const end=new Date();end.setUTCHours(0,0,0,0);const start=new Date(end);start.setUTCDate(start.getUTCDate()-364);const r=await fetch(`/api/daily-logs?from=${iso(start)}&to=${iso(end)}&today=${iso(end)}`);const j=await r.json();setLogs(j.logs??[]);setStats(j.stats??{})};load()},[]);

	useEffect(()=>{const loadTodos=async()=>{const r=await fetch(`/api/todos?date=${today}`);if(!r.ok)return;const j=await r.json();setTodos(j.todos??[])};loadTodos()},[today]);

	const map=new Map(logs.map(l=>[l.logDate.slice(0,10),l]));

	async function importFile(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;try{const payload=JSON.parse(await f.text());const r=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(await r.text());alert('Roadmap imported successfully.')}catch(err){alert(err instanceof Error?err.message:'Import failed')}e.target.value='';}

	return (
		<AppShell>
			<header className="mb-6">
				<h1 className="text-3xl font-bold">Dashboard</h1>
				<p className="mt-1 text-slate-500">Your learning calendar and backup tools.</p>
			</header>

			<Card className="p-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<h2 className="font-semibold">Today’s tasks</h2>
						<p className="text-sm text-slate-500">Tasks scheduled for {today}.</p>
					</div>
					<Button variant="outline" onClick={()=>location.href='/calendar'}>Open full calendar</Button>
				</div>

				<div className="mt-5">
					{todos.length===0 ? (
						<p className="text-sm text-slate-500">No tasks for today.</p>
					) : (
						<div className="space-y-2">
							{todos.map(t=> (
								<div key={t.id} className="rounded-xl border border-[hsl(var(--line))] p-3 flex items-center justify-between">
									<div>
										<div className="font-medium">{t.title}</div>
										{t.notes && <div className="text-xs text-slate-500">{t.notes}</div>}
									</div>
									<div className="text-xs text-slate-500">{t.completed ? 'Done' : ''}</div>
								</div>
							))}
						</div>
					)}
				</div>
			</Card>

			<Card className="mt-5 p-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<h2 className="font-semibold">Import / Export</h2>
						<p className="mt-1 text-sm text-slate-500">Back up or restore your roadmap and calendar data.</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={importFile}/>
						<Button variant="outline" onClick={()=>file.current?.click()}>Import JSON</Button>
						<Button onClick={()=>location.href='/api/export?format=json'}>Export JSON</Button>
						<Button variant="outline" onClick={()=>location.href='/api/export?format=markdown'}>Export Markdown</Button>
					</div>
				</div>
			</Card>
		</AppShell>
	);
}
