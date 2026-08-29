'use client';
import { useState } from 'react';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card } from '@/components/ui';
import { CalendarDays, Check, ListTodo, Pencil, Plus, Trash2, X } from 'lucide-react';

type Todo={id:string;todoDate:string;title:string;notes:string;completed:boolean;position:number;roadmapId:string|null;topicId:string|null};
const iso=(d:Date)=>d.toISOString().slice(0,10);
export default function TodosPage(){
 const [date,setDate]=useState(iso(new Date())),[title,setTitle]=useState(''),[notes,setNotes]=useState(''),[editing,setEditing]=useState<string|null>(null);
 const {data,isLoading:loading}=useGetJsonQuery({url:`/api/todos?date=${date}`,tag:'todos'});
 const todos=((data as any)?.todos||[]) as Todo[];
 const [request]=useRequestMutation();
 const reset=()=>{setEditing(null);setTitle('');setNotes('')};
 const submit=async()=>{
   if(!title.trim())return;
   try{
     await request({url:editing?`/api/todos/${editing}`:'/api/todos',method:editing?'PATCH':'POST',body:editing?{title:title.trim(),notes:notes.trim()}:{todoDate:date,title:title.trim(),notes:notes.trim()},invalidate:['todos','calendar','dashboard']}).unwrap();
     reset();
   }catch(e){alert(e instanceof Error?e.message:'Unable to save TODO');}
 };
 const toggle=async(t:Todo)=>{try{await request({url:`/api/todos/${t.id}`,method:'PATCH',body:{completed:!t.completed},invalidate:['todos','calendar','dashboard']}).unwrap();}catch(e){alert(e instanceof Error?e.message:'Unable to update TODO')}};
 const remove=async(t:Todo)=>{if(!confirm(`Delete “${t.title}”?`))return;try{await request({url:`/api/todos/${t.id}`,method:'DELETE',invalidate:['todos','calendar','dashboard']}).unwrap();}catch(e){alert(e instanceof Error?e.message:'Unable to delete TODO')}};
 return <AppShell><header className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2"><ListTodo className="text-indigo-600" size={21}/><h1 className="text-3xl font-bold">TODO</h1><Badge>{todos.filter(t=>!t.completed).length} pending</Badge></div><p className="mt-2 text-sm text-slate-500">Plan daily learning actions separately from your roadmap nodes.</p></div><Button variant="outline" onClick={()=>setDate(iso(new Date()))}><CalendarDays size={15}/> Today</Button></header><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><Card className="p-5"><div className="text-xs font-semibold uppercase tracking-[.18em] text-indigo-600">Plan a day</div><label className="studio-field mt-4">Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><div className="mt-4 grid gap-2"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder={editing?'Update TODO':'What should you learn?'} className="rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5 text-sm"/><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes (optional)" className="h-24 rounded-xl border border-[hsl(var(--line))] bg-transparent p-3 text-sm"/><div className="flex gap-2"><Button onClick={submit} disabled={!title.trim()}>{editing?<Pencil size={15}/>:<Plus size={15}/>} {editing?'Update':'Add TODO'}</Button>{editing&&<Button variant="outline" onClick={reset}><X size={15}/> Cancel</Button>}</div></div></Card><Card className="p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">{date}</h2><p className="text-xs text-slate-500">{todos.length} task{todos.length===1?'':'s'}</p></div><a href={`/calendar?date=${date}`} className="text-xs font-medium text-indigo-600">Open in calendar</a></div>{loading?<div className="mt-8 flex justify-center"><span className="studio-spinner"/></div>:<div className="mt-4 space-y-2">{todos.map(t=><div key={t.id} className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--line))] p-3"><button onClick={()=>toggle(t)} className={`grid size-8 shrink-0 place-items-center rounded-xl border ${t.completed?'border-emerald-500 bg-emerald-500 text-white':'border-[hsl(var(--line))]'}`}><Check size={15}/></button><div className="min-w-0 flex-1"><div className={`text-sm font-medium ${t.completed?'line-through text-slate-400':''}`}>{t.title}</div>{t.notes&&<div className="mt-0.5 text-xs text-slate-500">{t.notes}</div>}</div><button onClick={()=>{setEditing(t.id);setTitle(t.title);setNotes(t.notes||'')}} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil size={15}/></button><button onClick={()=>remove(t)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={15}/></button></div>)}{!todos.length&&<div className="rounded-2xl border border-dashed border-[hsl(var(--line))] p-10 text-center text-sm text-slate-400">No tasks for this date.</div>}</div>}</Card></div></AppShell>
}
