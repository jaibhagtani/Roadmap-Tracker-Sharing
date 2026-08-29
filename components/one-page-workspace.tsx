'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import { CalendarDays, ChevronLeft, ChevronRight, Check, Pencil, Plus, Trash2, Users, Lock, X, Share2, Eye, UsersRound } from 'lucide-react';
import { Card, Button } from './ui';
import { RoadmapEditor } from './roadmap-editor';

type Todo={id:string;todoDate:string;title:string;notes:string;completed:boolean;position:number;roadmapId:string|null;visibility:'private'|'friends';roadmap?:{id:string;title:string}|null};
type RoadmapRef={id:string;title:string;privacy?:string;shareSlug?:string};
const iso=(d:Date)=>d.toISOString().slice(0,10);
const startOfMonth=(d:Date)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1));
const monthLabel=(d:Date)=>d.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});

export function OnePageWorkspace(){
  useEffect(()=>{
    document.body.classList.add('one-page-mode');
    return ()=>document.body.classList.remove('one-page-mode');
  },[]);
  const today=useMemo(()=>new Date(),[]);
  const [month,setMonth]=useState(()=>startOfMonth(today));
  const [selected,setSelected]=useState(iso(today));
  const rangeStart=useMemo(() => {
    const d = new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1));
    d.setUTCDate(1-d.getUTCDay());
    return d;
  },[month]);
  const rangeEnd=useMemo(() => {
    const d = new Date(rangeStart);
    d.setUTCDate(rangeStart.getUTCDate()+41);
    return d;
  },[rangeStart]);
  const todosQuery = useGetJsonQuery(
    { url:`/api/todos?from=${iso(rangeStart)}&to=${iso(rangeEnd)}`, tag:'todos' }
  );
  const roadmapsQuery = useGetJsonQuery({ url:'/api/roadmaps', tag:'roadmaps' });
  const todos = (((todosQuery.data as any)?.todos || []) as Todo[]);
  const roadmaps = ((((roadmapsQuery.data as any)?.roadmaps || []) as any[]).map((x:any)=>({
    id:x.id,title:x.title,privacy:x.privacy,shareSlug:x.shareSlug
  })) as RoadmapRef[]);
  const loading = todosQuery.isLoading || roadmapsQuery.isLoading;
  const [request] = useRequestMutation();
  const [taskModal,setTaskModal]=useState<{open:boolean;mode:'create'|'edit';task?:Todo}>({open:false,mode:'create'});
  const [form,setForm]=useState({title:'',notes:'',todoDate:iso(today),completed:false,visibility:'private' as 'private'|'friends',roadmapId:''});
  const [saving,setSaving]=useState(false);

  const monthDays=useMemo(()=>{const first=startOfMonth(month);const offset=first.getUTCDay();const daysInMonth=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();const cells:Array<Date|null>=Array.from({length:offset},()=>null);for(let i=1;i<=daysInMonth;i++)cells.push(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),i)));while(cells.length<42)cells.push(null);return cells},[month]);
  const todoMap=useMemo(()=>{const m=new Map<string,Todo[]>();for(const t of todos){const k=t.todoDate.slice(0,10);m.set(k,[...(m.get(k)||[]),t])}return m},[todos]);
  const selectedTodos=(todoMap.get(selected)||[]).sort((a,b)=>a.position-b.position);
  const openCreate=(date:string)=>{setSelected(date);setForm({title:'',notes:'',todoDate:date,completed:false,visibility:'private',roadmapId:roadmaps[0]?.id||''});setTaskModal({open:true,mode:'create'})};
  const openEdit=(t:Todo)=>{setSelected(t.todoDate.slice(0,10));setForm({title:t.title,notes:t.notes||'',todoDate:t.todoDate.slice(0,10),completed:t.completed,visibility:t.visibility||'private',roadmapId:t.roadmapId||''});setTaskModal({open:true,mode:'edit',task:t});};
  async function saveTask(){
    if(!form.title.trim())return;
    setSaving(true);
    const payload={title:form.title.trim(),notes:form.notes.trim(),todoDate:form.todoDate,completed:form.completed,visibility:form.visibility,roadmapId:form.visibility==='friends'?form.roadmapId||null:(taskModal.task?.roadmapId||null)};
    const j = await request({
      url: taskModal.mode==='create' ? '/api/todos' : `/api/todos/${taskModal.task!.id}`,
      method: taskModal.mode==='create' ? 'POST' : 'PATCH',
      body: payload,
      invalidate: ['todos','calendar','dashboard'],
    });
    setSaving(false);
    if((j as any)?.error) return alert((j as any).error);
    setTaskModal({open:false,mode:'create'});
  }
  async function toggle(t:Todo){
    const j = await request({
      url:`/api/todos/${t.id}`,
      method:'PATCH',
      body:{completed:!t.completed},
      invalidate:['todos','calendar','dashboard'],
    });
    if((j as any)?.error) alert((j as any).error);
  }
  async function del(t:Todo){
    if(!confirm(`Delete “${t.title}”?`))return;
    const j = await request({
      url:`/api/todos/${t.id}`,
      method:'DELETE',
      invalidate:['todos','calendar','dashboard'],
    });
    if((j as any)?.error) alert((j as any).error);
  }

  return <div className="one-page-workspace">
    <section className="one-page-editor-frame"><RoadmapEditor /></section>
    <section className="one-page-bottom-grid">
      <div className="one-page-planner-main">
        <Card className="one-page-calendar-card"><div className="one-page-panel-head"><div><div className="one-page-kicker">Calendar</div><h2>{monthLabel(month)}</h2></div><div className="flex items-center gap-1"><Button variant="outline" onClick={()=>setMonth(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()-1,1)))}><ChevronLeft size={15}/></Button><Button variant="outline" onClick={()=>setMonth(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1)))}><ChevronRight size={15}/></Button></div></div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span key={d}>{d}</span>)}</div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">{monthDays.map((d,i)=>{if(!d)return <div key={`e-${i}`} />;const k=iso(d);const tasks=todoMap.get(k)||[];const isToday=k===iso(today);const isSelected=k===selected;return <div key={k} className={`group relative min-h-[62px] rounded-xl border p-1.5 ${isSelected?'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/25':'border-[hsl(var(--line))]'}`}><button className="absolute inset-0 rounded-xl" onClick={()=>setSelected(k)} aria-label={`Select ${k}`}/><div className="relative z-[2] flex items-center justify-between"><button onClick={()=>setSelected(k)} className={`grid size-6 place-items-center rounded-full text-xs ${isToday?'bg-indigo-600 font-bold text-white':''}`}>{d.getUTCDate()}</button><button onClick={()=>openCreate(k)} className="grid size-6 place-items-center rounded-md text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white dark:hover:bg-slate-800"><Plus size={12}/></button></div><div className="relative z-[2] mt-1 space-y-1">{tasks.slice(0,2).map(t=><button key={t.id} onClick={()=>openEdit(t)} className={`block w-full truncate rounded-md px-1 py-0.5 text-left text-[9px] ${t.completed?'bg-emerald-50 text-emerald-700 line-through dark:bg-emerald-950/30 dark:text-emerald-300':'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{t.title}</button>)}{tasks.length>2&&<span className="block px-1 text-[8px] text-slate-400">+{tasks.length-2}</span>}</div></div>})}</div>
        </Card>
        <Card className="one-page-task-card"><div className="one-page-panel-head"><div><div className="one-page-kicker">Tasks for {selected}</div><h2>{selectedTodos.length} task{selectedTodos.length===1?'':'s'}</h2></div><Button onClick={()=>openCreate(selected)}><Plus size={15}/> Add</Button></div>{loading?<div className="one-page-loading"><span className="studio-spinner"/>Loading tasks…</div>:<div className="space-y-2 overflow-auto">{selectedTodos.map(t=><div key={t.id} className="one-page-task-row"><button onClick={()=>void toggle(t)} className={`grid size-7 shrink-0 place-items-center rounded-lg border ${t.completed?'border-emerald-600 bg-emerald-600 text-white':'border-[hsl(var(--line))]'}`}><Check size={13}/></button><div className="min-w-0 flex-1"><div className={`truncate text-sm font-semibold ${t.completed?'line-through text-slate-400':''}`}>{t.title}</div><div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">{t.visibility==='friends'?<><Users size={11} className="text-emerald-600"/> Friends can view</>:<><Lock size={11}/> Private</>}{t.roadmap?.title&&<span>· {t.roadmap.title}</span>}</div></div><button onClick={()=>openEdit(t)} className="one-page-icon-btn"><Pencil size={14}/></button><button onClick={()=>void del(t)} className="one-page-icon-btn danger"><Trash2 size={14}/></button></div>)}{!selectedTodos.length&&<div className="one-page-empty"><CalendarDays size={22}/><p>No tasks for this date.</p><Button variant="outline" onClick={()=>openCreate(selected)}><Plus size={14}/> Add task</Button></div>}</div>}</Card>
      </div>
      <Card className="one-page-community-card">
        <div className="one-page-panel-head"><div><div className="one-page-kicker">Community & Teams</div><h2>Keep learning together</h2></div><UsersRound size={18} className="text-indigo-600"/></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <a href="/community?tab=communities" className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 transition hover:border-indigo-300 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <div className="flex items-center gap-2 text-sm font-semibold"><Users size={15} className="text-indigo-600"/> Public communities</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">Discover public communities, view their roadmaps, and request collaborative access from the owner.</p>
          </a>
          <a href="/collaborate?tab=teams" className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 transition hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 text-sm font-semibold"><UsersRound size={15} className="text-emerald-600"/> Friends teams</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">Create a private group of friends where members collaborate directly on the same roadmap and chat.</p>
          </a>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/collaborate/create?type=community" className="one-page-inline-link">Create community</a>
          <a href="/collaborate/create?type=team" className="one-page-inline-link">Create team</a>
        </div>
      </Card>
    </section>
    {taskModal.open&&<div className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={e=>{if(e.currentTarget===e.target)setTaskModal({open:false,mode:'create'})}}><div className="w-full max-w-xl rounded-3xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{taskModal.mode==='edit'?'Edit task':'Add task'}</div><h3 className="mt-1 text-xl font-bold">Plan your learning</h3></div><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={()=>setTaskModal({open:false,mode:'create'})}><X size={17}/></button></div><div className="mt-5 grid gap-4"><label className="text-xs font-medium">Title<input autoFocus value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5"/></label><label className="text-xs font-medium">Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-1 h-24 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent p-3"/></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium">Date<input type="date" value={form.todoDate} onChange={e=>setForm({...form,todoDate:e.target.value})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5"/></label><label className="text-xs font-medium">Visibility<select value={form.visibility} onChange={e=>setForm({...form,visibility:e.target.value as 'private'|'friends'})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5"><option value="private">Private</option><option value="friends">Friends can view</option></select></label></div>{form.visibility==='friends'&&<label className="text-xs font-medium">Shared roadmap<select value={form.roadmapId} onChange={e=>setForm({...form,roadmapId:e.target.value})} className="mt-1 w-full rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5"><option value="">Select a roadmap</option>{roadmaps.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select><span className="mt-1 block text-[11px] text-slate-400">Friends with access to this roadmap can view this task.</span></label>}<label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.completed} onChange={e=>setForm({...form,completed:e.target.checked})}/> Mark completed</label></div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={()=>setTaskModal({open:false,mode:'create'})}>Cancel</Button><Button onClick={()=>void saveTask()} disabled={saving||!form.title.trim()}>{saving?<span className="studio-spinner"/>:'Save task'}</Button></div></div></div>}
    {/* <Card className="one-page-share-card"><div className="one-page-panel-head"><div><div className="one-page-kicker">Share access</div><h2>Friends can view & collaborate</h2></div><Share2 size={18} className="text-indigo-600"/></div><div className="space-y-2">{roadmaps.slice(0,4).map(r=><div key={r.id} className="one-page-share-row"><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{r.title}</div><div className="text-[10px] text-slate-400">{r.privacy==='public'?'Public · View only':r.privacy==='link'?'Friends / Link · Collab allowed':'Private'}</div></div>{r.privacy!=='private'&&r.shareSlug?<a className="one-page-icon-btn" href={`/share/${r.shareSlug}`} target="_blank" rel="noreferrer"><Eye size={14}/></a>:<span className="text-[10px] text-slate-400">Owner only</span>}</div>)}{!roadmaps.length&&<p className="text-xs text-slate-400">Create a roadmap in the editor to share it with friends.</p>}</div></Card> */}
  </div>;
}
