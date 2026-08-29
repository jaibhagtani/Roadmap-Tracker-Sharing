import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/ui';
import DashboardClient from '@/components/dashboard-client';
import DashboardPlanner from '@/components/dashboard-planner';
import { requireUser } from '@/lib/server-auth';
import { getCached, setCached, userCacheKey } from '@/lib/redis';
import { withRls } from '@/lib/db';
import { CalendarDays, Flame, Clock3, Trophy, ArrowRight, GitBranch, Users } from 'lucide-react';

function iso(d: Date) { return d.toISOString().slice(0, 10); }
function dateOnly(s: string) { return new Date(`${s}T00:00:00.000Z`); }

export default async function Dashboard() {
  const user = await requireUser();
  const end = new Date(); end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 364);
  const today = iso(end);
  const upcomingEnd = new Date(end); upcomingEnd.setUTCDate(upcomingEnd.getUTCDate() + 30);
  const upcomingTo = iso(upcomingEnd);

  const cacheKey = await userCacheKey(user.id, 'dashboard', `${today}:${upcomingTo}`);
  const cached = await getCached<any>(cacheKey);
  let dashboardData = cached;
  if (!dashboardData) {
  const [logs, allLogs, todos, roadmapCount, groupCount] = await withRls(user.id, async (tx) => Promise.all([
    tx.dailyLog.findMany({ where: { ownerId: user.id, logDate: { gte: dateOnly(iso(start)), lte: dateOnly(iso(end)) } }, orderBy: { logDate: 'asc' } }),
    tx.dailyLog.findMany({ where: { ownerId: user.id }, orderBy: { logDate: 'asc' } }),
    tx.todo.findMany({ where: { ownerId: user.id, todoDate: { gte: dateOnly(today), lte: dateOnly(upcomingTo) } }, orderBy: [{ todoDate: 'asc' }, { priority: 'desc' }, { position: 'asc' }, { createdAt: 'asc' }] }),
    tx.roadmap.count({ where: { ownerId: user.id } }),
    tx.collabGroup.count({ where: { ownerId: user.id } }),
  ]));
  dashboardData = { logs, allLogs, todos, roadmapCount, groupCount };
  await setCached(cacheKey, dashboardData, 15);
  }
  const { logs: cachedLogs, allLogs: rawAllLogs, todos, roadmapCount, groupCount } = dashboardData;
  const logs = (cachedLogs ?? []).map((x: any) => ({ ...x, logDate: new Date(x.logDate) }));
  const allLogs = (rawAllLogs ?? []).map((x: any) => ({ ...x, logDate: new Date(x.logDate) }));

  const active = allLogs.filter((x: any) => x.studyMinutes > 0 || x.resourcesCompleted > 0 || x.problemsSolved > 0).map((x: any) => x.logDate.toISOString().slice(0, 10));
  let longest = 0, current = 0;
  const set = new Set(active);
  const sorted = [...set].sort();
  for (let i = 0; i < sorted.length; i += 1) {
    if (i === 0 || (Date.parse(`${sorted[i]}T00:00:00Z`) - Date.parse(`${sorted[i - 1]}T00:00:00Z`)) === 86400000) current += 1;
    else current = 1;
    longest = Math.max(longest, current);
  }
  let cursor = dateOnly(today); cursor.setUTCHours(0, 0, 0, 0); current = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) { current += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }

  const stats = {
    totalStudyMinutes: allLogs.reduce((s: number, x: any) => s + x.studyMinutes, 0),
    activeDays: active.length,
    longestStreak: longest,
    currentStreak: current,
  };

  return (
    <AppShell>
      <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-indigo-600 dark:text-indigo-300">Learning command center</div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Good to see you back.</h1>
          <p className="mt-2 text-sm text-slate-500">Pick up where you left off and keep the roadmap moving.</p>
        </div>
        <div className="flex gap-2"><a href="/roadmap" className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium shadow-sm hover:bg-[hsl(var(--bg))]"><GitBranch size={15}/> Open roadmap</a><a href="/collaborate" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700"><Users size={15}/> Collaboration</a></div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          // { icon: Clock3, label: 'Study time', value: `${Math.floor(stats.totalStudyMinutes / 60)}h ${stats.totalStudyMinutes % 60}m`, hint: `${logs.length} logged days` },
          { icon: Flame, label: 'Current streak', value: `${stats.currentStreak} days`, hint: `Best: ${stats.longestStreak} days` },
          // { icon: Trophy, label: 'Active days', value: `${stats.activeDays}`, hint: 'Past year' },
          { icon: GitBranch, label: 'Roadmaps', value: `${roadmapCount}`, hint: `${groupCount} community ${groupCount === 1 ? 'group' : 'groups'}` },
        ].map((item) => (
          <Card key={item.label} className="relative overflow-hidden p-5">
            <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><item.icon size={17}/></div>
            <div className="text-xs text-slate-500">{item.label}</div><div className="mt-1 text-2xl font-bold">{item.value}</div><div className="mt-1 text-[11px] text-slate-500">{item.hint}</div>
          </Card>
        ))}
      </div>

      <DashboardPlanner initialTodos={todos.map((t:any)=>({ ...t, todoDate: t.todoDate.toISOString().slice(0,10), priority: t.priority ?? 0 }))} today={today} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Learning activity</h2><p className="text-xs text-slate-500">Recent learning signal.</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] dark:bg-slate-900">365d</span></div>
          <div className="grid grid-cols-12 gap-1.5">
            {Array.from({ length: 84 }, (_, i) => {
              const d = new Date(end); d.setUTCDate(d.getUTCDate() - (83 - i)); const key = iso(d); const log = allLogs.find((x: any) => iso(x.logDate) === key); const intensity = log ? Math.min(4, Math.ceil((log.studyMinutes + log.resourcesCompleted * 20 + log.problemsSolved * 10) / 60)) : 0;
              return <span title={`${key}${log ? ` · ${log.studyMinutes}m` : ''}`} key={key} className={`aspect-square rounded-[4px] ${intensity === 0 ? 'bg-slate-100 dark:bg-slate-900' : intensity === 1 ? 'bg-indigo-100 dark:bg-indigo-950/60' : intensity === 2 ? 'bg-indigo-200 dark:bg-indigo-900' : intensity === 3 ? 'bg-indigo-400 dark:bg-indigo-700' : 'bg-indigo-600 dark:bg-indigo-500'}`} />;
            })}
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400"><span>Less</span><div className="flex gap-1"><i className="h-2.5 w-2.5 rounded-[3px] bg-slate-100 dark:bg-slate-900"/><i className="h-2.5 w-2.5 rounded-[3px] bg-indigo-200 dark:bg-indigo-900"/><i className="h-2.5 w-2.5 rounded-[3px] bg-indigo-400 dark:bg-indigo-700"/><i className="h-2.5 w-2.5 rounded-[3px] bg-indigo-600 dark:bg-indigo-500"/></div><span>More</span></div>
        </Card>
        <Card className="p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Roadmap workspace</h2><p className="mt-1 text-xs text-slate-500">Create, edit, and collaborate from one place.</p></div><GitBranch size={18} className="text-indigo-500"/></div><div className="mt-4 grid gap-2"><a href="/roadmap" className="rounded-xl border border-[hsl(var(--line))] p-3 text-sm font-medium hover:bg-[hsl(var(--bg))]">Open editor</a><a href="/collaborate" className="rounded-xl border border-[hsl(var(--line))] p-3 text-sm font-medium hover:bg-[hsl(var(--bg))]">Open teams & collaboration</a><a href="/community" className="rounded-xl border border-[hsl(var(--line))] p-3 text-sm font-medium hover:bg-[hsl(var(--bg))]">Discover community roadmaps</a></div></Card>
      </div>
      <Card className="mt-5 p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold">Backup & portability</h2><p className="mt-1 text-sm text-slate-500">Export your roadmaps and calendar data before a migration or large refactor.</p></div><DashboardClient exportPath="/api/export?format=json" /></div></Card>
    </AppShell>
  );
}
