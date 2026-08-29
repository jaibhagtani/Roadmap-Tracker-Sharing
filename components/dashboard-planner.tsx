'use client';

import { useMemo, useState } from 'react';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2 } from 'lucide-react';
import { Button, Card } from './ui';

type Todo = {
  id: string;
  todoDate: string | Date;
  title: string;
  notes: string;
  completed: boolean;
  priority: number;
  visibility: 'private' | 'friends';
  roadmapId?: string | null;
};

type Props = { initialTodos: Todo[]; today: string };

const PRIORITY = {
  3: { label: 'HIGH', className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900' },
  2: { label: 'MEDIUM', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900' },
  1: { label: 'LOW', className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900' },
  0: { label: 'NONE', className: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800' },
} as const;

function keyFromDate(d: Date) { return d.toISOString().slice(0, 10); }
function dateFromKey(key: string) { return new Date(`${key}T00:00:00.000Z`); }
function priorityOf(n: number) { return PRIORITY[Math.max(0, Math.min(3, Number(n) || 0)) as 0|1|2|3]; }

export default function DashboardPlanner({ initialTodos, today }: Props) {
  const initialNormalized = useMemo(() => initialTodos.map(t => ({ ...t, todoDate: typeof t.todoDate === 'string' ? t.todoDate.slice(0,10) : keyFromDate(new Date(t.todoDate)) })), [initialTodos]);
  const [anchor, setAnchor] = useState(today);
  const [modal, setModal] = useState<{open:boolean; mode:'create'|'edit'; task:Partial<Todo>}>({ open:false, mode:'create', task:{} });
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => {
    const start = dateFromKey(anchor);
    return Array.from({ length: 14 }, (_, i) => { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); return keyFromDate(d); });
  }, [anchor]);
  const queryEnd = useMemo(() => {
    const d=dateFromKey(anchor);
    d.setUTCDate(d.getUTCDate()+30);
    return keyFromDate(d);
  }, [anchor]);
  const todosQuery = useGetJsonQuery(
    { url:`/api/todos?from=${anchor}&to=${queryEnd}`, tag:`todos:${anchor}:${queryEnd}` }
  );
  const [request] = useRequestMutation();
  const todos = (((todosQuery.data as any)?.todos || initialNormalized) as Todo[]).map(t => ({
    ...t,
    todoDate: String(t.todoDate).slice(0,10),
  }));
  const visibleTodos = useMemo(() => todos.filter(t => range.includes(String(t.todoDate).slice(0,10))).sort((a,b) => `${a.todoDate}${a.priority}${a.title}`.localeCompare(`${b.todoDate}${b.priority}${b.title}`)), [todos, range]);
  const upcoming = useMemo(() => todos.filter(t => String(t.todoDate).slice(0,10) >= today).sort((a,b)=>`${a.todoDate}${b.completed?'1':'0'}${b.priority}${a.title}`.localeCompare(`${b.todoDate}${a.completed?'1':'0'}${a.priority}${b.title}`)).slice(0,8), [todos, today]);
  const byDay = useMemo(() => {
    const m = new Map<string, Todo[]>();
    for (const day of range) m.set(day, []);
    for (const t of visibleTodos) m.get(String(t.todoDate).slice(0,10))?.push(t);
    return m;
  }, [range, visibleTodos]);

  async function refresh() {
    await todosQuery.refetch();
  }

  async function save() {
    const task = modal.task;
    if (!task.title?.trim() || !task.todoDate) return;
    setSaving(true);
    try {
      const isEdit = modal.mode === 'edit' && !!task.id;
      const result = await request({
        url:isEdit ? `/api/todos/${task.id}` : '/api/todos',
        method:isEdit ? 'PATCH' : 'POST',
        body:{
          title:task.title.trim(),
          notes:task.notes || '',
          todoDate:String(task.todoDate).slice(0,10),
          completed:!!task.completed,
          priority:Number(task.priority || 0),
          visibility:task.visibility || 'private'
        },
        invalidate:['todos','calendar','dashboard'],
      });
      if((result as any).error) return;
      setModal({open:false,mode:'create',task:{}});
      await refresh();
    } finally { setSaving(false); }
  }

  async function toggle(todo:Todo) {
    const result=await request({
      url:`/api/todos/${todo.id}`,
      method:'PATCH',
      body:{completed:!todo.completed},
      invalidate:['todos','calendar','dashboard'],
    });
    if(!(result as any).error) await refresh();
  }
  async function remove(todo:Todo) {
    if (!window.confirm(`Delete “${todo.title}”?`)) return;
    const result=await request({
      url:`/api/todos/${todo.id}`,
      method:'DELETE',
      invalidate:['todos','calendar','dashboard'],
    });
    if(!(result as any).error) await refresh();
  }

  return (
    <section className="mt-5">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div><div className="text-xs font-semibold uppercase tracking-[.18em] text-indigo-600 dark:text-indigo-300">Plan your learning</div><h2 className="mt-1 text-xl font-bold tracking-tight">Calendar & upcoming tasks</h2><p className="mt-1 text-sm text-slate-500">See the next two weeks and add tasks without leaving the dashboard.</p></div>
        <Button onClick={()=>setModal({open:true,mode:'create',task:{todoDate:today,priority:2,visibility:'private',completed:false}})}><Plus size={15}/> Add task</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><div className="text-sm font-semibold">{dateFromKey(anchor).toLocaleDateString(undefined,{month:'long',year:'numeric'})}</div><div className="flex gap-1"><button className="dashboard-icon-btn" onClick={()=>{const d=dateFromKey(anchor);d.setUTCDate(d.getUTCDate()-14);setAnchor(keyFromDate(d));}} aria-label="Previous"><ChevronLeft size={15}/></button><button className="dashboard-icon-btn" onClick={()=>setAnchor(today)}>Today</button><button className="dashboard-icon-btn" onClick={()=>{const d=dateFromKey(anchor);d.setUTCDate(d.getUTCDate()+14);setAnchor(keyFromDate(d));}} aria-label="Next"><ChevronRight size={15}/></button></div></div>
          <div className="grid grid-cols-7 gap-1.5 text-[10px] text-slate-400"><span className="py-1 text-center">Sun</span><span className="py-1 text-center">Mon</span><span className="py-1 text-center">Tue</span><span className="py-1 text-center">Wed</span><span className="py-1 text-center">Thu</span><span className="py-1 text-center">Fri</span><span className="py-1 text-center">Sat</span></div>
          <div className="mt-1 grid grid-cols-7 gap-1.5">
            {range.map(day => { const tasks=byDay.get(day)||[]; const selected=day===today; return <button key={day} onClick={()=>setModal({open:true,mode:'create',task:{todoDate:day,priority:2,visibility:'private',completed:false}})} className={`min-h-20 rounded-xl border p-2 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 ${selected?'border-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-900':'border-[hsl(var(--line))] bg-[hsl(var(--card))]'}`}><div className="flex items-center justify-between"><span className={`text-xs font-semibold ${selected?'text-indigo-600':'text-slate-700 dark:text-slate-200'}`}>{Number(day.slice(-2))}</span>{tasks.length>0&&<span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{tasks.length}</span>}</div><div className="mt-2 space-y-1">{tasks.slice(0,2).map(t=><span key={t.id} className={`block truncate rounded-md px-1.5 py-1 text-[9px] font-medium ${t.completed?'line-through opacity-50':'bg-slate-100 dark:bg-slate-900'}`}>{t.title}</span>)}</div></button>; })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Upcoming</h3><p className="text-[11px] text-slate-500">Next scheduled learning tasks.</p></div><a href="/calendar" className="text-[11px] font-semibold text-indigo-600">Open calendar</a></div>
          <div className="space-y-2">
            {upcoming.length === 0 && <div className="rounded-xl border border-dashed border-[hsl(var(--line))] p-7 text-center text-sm text-slate-500"><CalendarDays className="mx-auto text-slate-400" size={22}/><p className="mt-2 font-medium">No upcoming tasks</p><p className="mt-1 text-xs">Add one from the dashboard.</p></div>}
            {upcoming.map(t=>{const p=priorityOf(t.priority); return <div key={t.id} className="group flex items-start gap-3 rounded-xl border border-[hsl(var(--line))] p-3"><button onClick={()=>toggle(t)} className={`mt-0.5 grid size-6 place-items-center rounded-full border ${t.completed?'border-emerald-500 bg-emerald-500 text-white':'border-slate-300 text-transparent dark:border-slate-700'}`} aria-label="Toggle task"><Check size={13}/></button><div className="min-w-0 flex-1"><div className={`text-sm font-medium ${t.completed?'line-through text-slate-400':''}`}>{t.title}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500"><span>{dateFromKey(String(t.todoDate).slice(0,10)).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span><span className={`rounded-full border px-1.5 py-0.5 font-bold ${p.className}`}>{p.label}</span></div>{t.notes&&<p className="mt-1 truncate text-[11px] text-slate-500">{t.notes}</p>}</div><div className="flex gap-1 opacity-70 group-hover:opacity-100"><button className="dashboard-icon-btn" onClick={()=>setModal({open:true,mode:'edit',task:{...t}})} title="Edit"><Pencil size={13}/></button><button className="dashboard-icon-btn" onClick={()=>void remove(t)} title="Delete"><Trash2 size={13}/></button></div></div>})}
          </div>
        </Card>
      </div>

      {modal.open && <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-semibold">{modal.mode==='edit'?'Edit task':'Add task'}</h3><p className="text-xs text-slate-500">Keep your next learning step clear and actionable.</p></div><button className="dashboard-icon-btn" onClick={()=>setModal({open:false,mode:'create',task:{}})}><X size={16}/></button></div><div className="grid gap-3"><input className="dashboard-field" autoFocus placeholder="Task title" value={modal.task.title||''} onChange={e=>setModal(m=>({...m,task:{...m.task,title:e.target.value}}))}/><textarea className="dashboard-field min-h-24" placeholder="Notes (optional)" value={modal.task.notes||''} onChange={e=>setModal(m=>({...m,task:{...m.task,notes:e.target.value}}))}/><div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium">Date<input className="dashboard-field mt-1" type="date" value={String(modal.task.todoDate||today).slice(0,10)} onChange={e=>setModal(m=>({...m,task:{...m.task,todoDate:e.target.value}}))}/></label><label className="text-xs font-medium">Priority<select className="dashboard-field mt-1" value={Number(modal.task.priority||0)} onChange={e=>setModal(m=>({...m,task:{...m.task,priority:Number(e.target.value)}}))}><option value={3}>HIGH</option><option value={2}>MEDIUM</option><option value={1}>LOW</option><option value={0}>NONE</option></select></label></div><div className="flex items-center justify-between rounded-xl border border-[hsl(var(--line))] p-3 text-xs"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!modal.task.completed} onChange={e=>setModal(m=>({...m,task:{...m.task,completed:e.target.checked}}))}/> Completed</label><span className="text-slate-500">Private dashboard task</span></div></div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={()=>setModal({open:false,mode:'create',task:{}})}>Cancel</Button><Button disabled={saving || !modal.task.title?.trim() || !modal.task.todoDate} onClick={()=>void save()}>{saving?'Saving…':modal.mode==='edit'?'Save changes':'Add task'}</Button></div></div></div>}
    </section>
  );
}
