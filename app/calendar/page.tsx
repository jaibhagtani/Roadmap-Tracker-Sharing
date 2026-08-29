'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import { AppShell } from '@/components/app-shell';
import { Card, Button } from '@/components/ui';
import { CalendarDays, Check, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Save, Trash2, X, Users, Lock, GripVertical } from 'lucide-react';

type Todo = {
  id:string; todoDate:string; title:string; notes:string; completed:boolean; position:number;
  roadmapId:string|null; topicId:string|null; visibility:'private'|'friends'; roadmap?:{id:string;title:string}|null;
};
type Log = {logDate:string;studyMinutes:number;topicsStudied:string[];resourcesCompleted:number;problemsSolved:number;learned:string;difficulties:string;tomorrowGoal:string};
type RoadmapRef = {id:string;title:string};
const iso=(d:Date)=>d.toISOString().slice(0,10);
const emptyLog=(d:string):Log=>({logDate:d,studyMinutes:0,topicsStudied:[],resourcesCompleted:0,problemsSolved:0,learned:'',difficulties:'',tomorrowGoal:''});
const startOfMonth=(d:Date)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1));
const monthLabel=(d:Date)=>d.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});

export default function Calendar(){
  const today=useMemo(()=>new Date(),[]);
  const initialDate=useMemo(()=>{const value=new URLSearchParams(typeof window==='undefined'?'':window.location.search).get('date');return value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:iso(today)},[today]);
  const [month,setMonth]=useState(()=>startOfMonth(new Date(`${initialDate}T00:00:00.000Z`)));
  const [selected,setSelected]=useState(initialDate);
  const [form,setForm]=useState<Log>(emptyLog(selected)); const [saving,setSaving]=useState(false);
  const rangeStartKey=iso(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1) - (new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1)).getUTCDay()) * 86400000));
  const rangeEndKey=iso(new Date(new Date(`${rangeStartKey}T00:00:00.000Z`).getTime() + 41 * 86400000));
  const logsQuery=useGetJsonQuery({url:`/api/daily-logs?from=${rangeStartKey}&to=${rangeEndKey}&today=${iso(today)}`,tag:'calendar'});
  const todosQuery=useGetJsonQuery({url:`/api/todos?from=${rangeStartKey}&to=${rangeEndKey}`,tag:'todos'});
  const roadmapsQuery=useGetJsonQuery({url:'/api/roadmaps',tag:'roadmaps'});
  const [request]=useRequestMutation();
  const logs=(((logsQuery.data as any)?.logs||[]) as Log[]);
  const stats=(logsQuery.data as any)?.stats||{};
  const todos=(((todosQuery.data as any)?.todos||[]) as Todo[]);
  const roadmaps=((((roadmapsQuery.data as any)?.roadmaps||[]) as any[]).map((x:any)=>({id:x.id,title:x.title})) as RoadmapRef[]);
  const loading=logsQuery.isLoading||todosQuery.isLoading||roadmapsQuery.isLoading;
  const [taskModal,setTaskModal]=useState<{open:boolean;mode:'create'|'edit';task?:Todo;date:string}>({open:false,mode:'create',date:initialDate});
  const [dateMenu,setDateMenu]=useState<string|null>(null);
  const [taskForm,setTaskForm]=useState({title:'',notes:'',todoDate:initialDate,completed:false,visibility:'private' as 'private'|'friends',roadmapId:''});

  const monthDays=useMemo(()=>{const first=startOfMonth(month);const offset=first.getUTCDay();const daysInMonth=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();const cells:Array<Date|null>=Array.from({length:offset},()=>null);for(let i=1;i<=daysInMonth;i++)cells.push(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),i)));while(cells.length<42)cells.push(null);return cells},[month]);
  const rangeStart=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1)); rangeStart.setUTCDate(1-rangeStart.getUTCDay()); const rangeEnd=new Date(rangeStart); rangeEnd.setUTCDate(rangeStart.getUTCDate()+41);
  useEffect(()=>{setForm(logs.find(x=>x.logDate.slice(0,10)===selected)||emptyLog(selected))},[selected,logs]);
  useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.get('newTask')==='1'){openCreate(initialDate);window.history.replaceState(null,'',`/calendar?date=${initialDate}`)}},[]);

  const logMap=new Map(logs.map(l=>[l.logDate.slice(0,10),l]));
  const selectedTodos=todos.filter(t=>t.todoDate.slice(0,10)===selected).sort((a,b)=>a.position-b.position);
  const todoMap=useMemo(()=>{const m=new Map<string,Todo[]>();for(const t of todos){const k=t.todoDate.slice(0,10);m.set(k,[...(m.get(k)||[]),t])}return m},[todos]);
  const openCreate=(date:string)=>{setSelected(date);setDateMenu(null);setTaskForm({title:'',notes:'',todoDate:date,completed:false,visibility:'private',roadmapId:roadmaps[0]?.id||''});setTaskModal({open:true,mode:'create',date})};
  const openEdit=(task:Todo)=>{setTaskForm({title:task.title,notes:task.notes||'',todoDate:task.todoDate.slice(0,10),completed:task.completed,visibility:task.visibility||'private',roadmapId:task.roadmapId||''});setSelected(task.todoDate.slice(0,10));setTaskModal({open:true,mode:'edit',task,date:task.todoDate.slice(0,10)});};
  async function saveTask(){
    if(!taskForm.title.trim())return;
    setSaving(true);
    const payload={title:taskForm.title.trim(),notes:taskForm.notes.trim(),todoDate:taskForm.todoDate,completed:taskForm.completed,visibility:taskForm.visibility,roadmapId:taskForm.visibility==='friends'?taskForm.roadmapId||null:(taskModal.task?.roadmapId||null)};
    try{
      await request({url:taskModal.mode==='create'?'/api/todos':`/api/todos/${taskModal.task!.id}`,method:taskModal.mode==='create'?'POST':'PATCH',body:payload,invalidate:['todos','calendar','dashboard']}).unwrap();
      setTaskModal({open:false,mode:'create',date:taskForm.todoDate});
    }catch(e){alert(e instanceof Error?e.message:'Unable to save task');}
    finally{setSaving(false);}
  }
  async function toggleTodo(t:Todo){try{await request({url:`/api/todos/${t.id}`,method:'PATCH',body:{completed:!t.completed},invalidate:['todos','calendar','dashboard']}).unwrap();}catch(e){alert(e instanceof Error?e.message:'Unable to update task')}}
  async function deleteTodo(t:Todo){if(!confirm(`Delete “${t.title}”?`))return;try{await request({url:`/api/todos/${t.id}`,method:'DELETE',invalidate:['todos','calendar','dashboard']}).unwrap();}catch(e){alert(e instanceof Error?e.message:'Unable to delete task')}}
  async function saveLog(){
    setSaving(true);
    try{
      await request({url:'/api/daily-logs',method:'PUT',body:{...form,logDate:selected},invalidate:['calendar','dashboard']}).unwrap();
    }catch(e){alert(e instanceof Error?e.message:'Unable to save log')}
    finally{setSaving(false);}
  }


  return <AppShell>
    <div className="flex h-[calc(100vh-110px)] min-h-[620px] flex-col gap-4 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div><div className="flex items-center gap-2"><CalendarDays size={20} className="text-indigo-600"/><h1 className="text-2xl font-bold tracking-tight">Learning Calendar</h1></div><p className="mt-1 text-sm text-slate-500">Compact month view on the left, tasks and logs on the right.</p></div>
        <div className="flex items-center gap-2"><Button variant="outline" onClick={()=>setMonth(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()-1,1)))}><ChevronLeft size={16}/></Button><div className="min-w-36 text-center text-sm font-semibold">{monthLabel(month)}</div><Button variant="outline" onClick={()=>setMonth(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1)))}><ChevronRight size={16}/></Button><Button variant="outline" onClick={()=>{setMonth(startOfMonth(today));setSelected(iso(today))}}>Today</Button></div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(460px,.82fr)_minmax(560px,1.18fr)]">
        <Card className="min-h-0 overflow-hidden p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Month</div><div className="text-lg font-semibold">{monthLabel(month)}</div></div><Button onClick={()=>openCreate(selected)}><Plus size={15}/> Add task</Button></div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=><span key={x}>{x}</span>)}</div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {monthDays.map((d,i)=>{if(!d)return <div key={`e-${i}`} />;const k=iso(d);const tasks=todoMap.get(k)||[];const log=logMap.get(k);const isSelected=k===selected;const isToday=k===iso(today);return <div key={k} className={`group relative min-h-[82px] rounded-xl border p-2 transition ${isSelected?'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/10 dark:bg-indigo-950/25':'border-[hsl(var(--line))] hover:bg-slate-50 dark:hover:bg-slate-900/40'}`}>
              <button className="absolute inset-0 rounded-xl" aria-label={`Select ${k}`} onClick={()=>{setSelected(k);setDateMenu(null)}}/>
              <div className="relative z-[2] flex items-center justify-between"><button onClick={()=>{setSelected(k);setDateMenu(k)}} className={`grid size-6 place-items-center rounded-full text-xs ${isToday?'bg-indigo-600 font-bold text-white':''}`}>{d.getUTCDate()}</button><button onClick={()=>setDateMenu(dateMenu===k?null:k)} className="grid size-6 place-items-center rounded-md text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800"><MoreHorizontal size={14}/></button></div>
              <div className="relative z-[2] mt-1 space-y-1">{tasks.slice(0,3).map(t=><button key={t.id} onClick={()=>openEdit(t)} className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] ${t.completed?'bg-emerald-50 text-emerald-700 line-through dark:bg-emerald-950/30 dark:text-emerald-300':'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{t.title}</button>)}{tasks.length>3&&<span className="block px-1.5 text-[9px] text-slate-400">+{tasks.length-3} more</span>}{log?.studyMinutes? <span className="block px-1.5 text-[9px] font-semibold text-indigo-600">{log.studyMinutes}m</span>:null}</div>
              {dateMenu===k&&<div className="absolute right-2 top-8 z-30 w-36 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] p-1.5 shadow-xl"><button onClick={()=>openCreate(k)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"><Plus size={13}/> Add task</button><button onClick={()=>{setSelected(k);setDateMenu(null)}} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil size={13}/> Edit day log</button></div>}
            </div>})}
          </div>
        </Card>

        <div className="grid min-h-0 gap-4 overflow-hidden xl:grid-rows-[minmax(260px,.95fr)_minmax(260px,1.05fr)]">
          <Card className="min-h-0 overflow-auto p-4 sm:p-5">
            <div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Tasks</div><h2 className="mt-1 text-lg font-semibold">{selected}</h2><p className="text-xs text-slate-500">Click a task to edit it. Use the calendar date menu to add another.</p></div><Button onClick={()=>openCreate(selected)}><Plus size={15}/> Add</Button></div>
            <div className="mt-4 space-y-2">{selectedTodos.map(t=><div key={t.id} className="flex items-center gap-2 rounded-xl border border-[hsl(var(--line))] px-3 py-2.5"><button onClick={()=>toggleTodo(t)} className={`grid size-7 shrink-0 place-items-center rounded-lg border ${t.completed?'border-indigo-600 bg-indigo-600 text-white':'border-[hsl(var(--line))]'}`}><Check size={14}/></button><GripVertical size={14} className="shrink-0 text-slate-300"/><div className="min-w-0 flex-1"><div className={`truncate text-sm ${t.completed?'text-slate-400 line-through':''}`}>{t.title}</div>{t.notes&&<div className="truncate text-xs text-slate-400">{t.notes}</div>}<div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">{t.visibility==='friends'?<span className="inline-flex items-center gap-1 text-emerald-600"><Users size={11}/> Friends can view</span>:<span className="inline-flex items-center gap-1"><Lock size={11}/> Private</span>}{t.roadmap?.title&&<span>· {t.roadmap.title}</span>}</div></div><button onClick={()=>openEdit(t)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil size={15}/></button><button onClick={()=>deleteTodo(t)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={15}/></button></div>)}{!selectedTodos.length&&<div className="rounded-xl border border-dashed border-[hsl(var(--line))] p-5 text-center text-sm text-slate-400">No tasks for this date. Add one to start planning.</div>}</div>
          </Card>
          <Card className="min-h-0 overflow-auto p-4 sm:p-5">
            <div className="flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Daily learning log</div><div className="mt-1 text-sm font-semibold">{selected}</div><div className="text-xs text-slate-500">{stats.currentStreak||0} day streak · {Math.floor((stats.totalStudyMinutes||0)/60)}h {(stats.totalStudyMinutes||0)%60}m total</div></div><Button onClick={saveLog} disabled={saving}><Save size={15}/> Save</Button></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-xs font-medium">Study minutes<input type="number" min="0" value={form.studyMinutes} onChange={e=>setForm({...form,studyMinutes:+e.target.value})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2"/></label><label className="text-xs font-medium">Problems<input type="number" min="0" value={form.problemsSolved} onChange={e=>setForm({...form,problemsSolved:+e.target.value})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2"/></label><label className="text-xs font-medium">Resources<input type="number" min="0" value={form.resourcesCompleted} onChange={e=>setForm({...form,resourcesCompleted:+e.target.value})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2"/></label><label className="text-xs font-medium sm:col-span-3">Topics studied<input value={form.topicsStudied.join(', ')} onChange={e=>setForm({...form,topicsStudied:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2"/></label><label className="text-xs font-medium sm:col-span-3">What I learned<textarea value={form.learned} onChange={e=>setForm({...form,learned:e.target.value})} className="mt-1 h-20 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent p-2.5"/></label><label className="text-xs font-medium sm:col-span-3">Difficulties<textarea value={form.difficulties} onChange={e=>setForm({...form,difficulties:e.target.value})} className="mt-1 h-20 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent p-2.5"/></label><label className="text-xs font-medium sm:col-span-3">Tomorrow's goal<textarea value={form.tomorrowGoal} onChange={e=>setForm({...form,tomorrowGoal:e.target.value})} className="mt-1 h-20 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent p-2.5"/></label></div>
          </Card>
        </div>
      </div>

      {taskModal.open&&<div className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(e)=>{if(e.currentTarget===e.target)setTaskModal({...taskModal,open:false})}}>
        <div className="w-full max-w-xl rounded-3xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{taskModal.mode==='edit'?'Edit task':'Add task'}</div><h3 className="mt-1 text-xl font-bold">Plan your learning</h3></div><button onClick={()=>setTaskModal({...taskModal,open:false})} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={17}/></button></div>
          <div className="mt-5 grid gap-4"><label className="text-xs font-medium">Title<input autoFocus value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5"/></label><label className="text-xs font-medium">Notes<textarea value={taskForm.notes} onChange={e=>setTaskForm({...taskForm,notes:e.target.value})} className="mt-1 h-24 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent p-3"/></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium">Date<input type="date" value={taskForm.todoDate} onChange={e=>setTaskForm({...taskForm,todoDate:e.target.value})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5"/></label><label className="text-xs font-medium">Visibility<select value={taskForm.visibility} onChange={e=>setTaskForm({...taskForm,visibility:e.target.value as 'private'|'friends'})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5"><option value="private">Private</option><option value="friends">Friends can view</option></select></label></div>{taskForm.visibility==='friends'&&<label className="text-xs font-medium">Roadmap used for friend access<select value={taskForm.roadmapId} onChange={e=>setTaskForm({...taskForm,roadmapId:e.target.value})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5"><option value="">Select a shared roadmap</option>{roadmaps.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select><span className="mt-1 block text-[11px] text-slate-400">Friends who already have access to this roadmap can view the task.</span></label>}
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={taskForm.completed} onChange={e=>setTaskForm({...taskForm,completed:e.target.checked})}/> Mark completed</label>
          </div>
          <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={()=>setTaskModal({...taskModal,open:false})}>Cancel</Button><Button onClick={()=>void saveTask()} disabled={saving||!taskForm.title.trim()}>{saving?<span className="studio-spinner"/>:<Save size={15}/>} Save task</Button></div>
        </div>
      </div>}
    </div>
  </AppShell>
}
