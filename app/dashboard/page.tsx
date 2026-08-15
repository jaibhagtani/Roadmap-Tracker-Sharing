import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/ui';
import DashboardClient from '@/components/dashboard-client';
import { requireUser } from '@/lib/server-auth';
import { withRls } from '@/lib/db';

function iso(d: Date) { return d.toISOString().slice(0, 10); }
function dateOnly(s: string) { return new Date(`${s}T00:00:00.000Z`); }

export default async function Dashboard() {
  const user = await requireUser();

  const end = new Date(); end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 364);
  const today = iso(end);

  const [logs, allLogs, todos] = await Promise.all([
    withRls(user.id, tx => tx.dailyLog.findMany({ where: { ownerId: user.id, logDate: { gte: dateOnly(iso(start)), lte: dateOnly(iso(end)) } }, orderBy: { logDate: 'asc' } })),
    withRls(user.id, tx => tx.dailyLog.findMany({ where: { ownerId: user.id }, orderBy: { logDate: 'asc' } })),
    withRls(user.id, tx => tx.todo.findMany({ where: { ownerId: user.id, todoDate: dateOnly(today) }, orderBy: [{ todoDate: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] })),
  ]);

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

  const stats = { totalStudyMinutes: allLogs.reduce((s: number, x: any) => s + x.studyMinutes, 0), activeDays: active.length, longestStreak: longest, currentStreak: current };

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
          <div className="flex items-center gap-2">
            <a href="/calendar" className="rounded border px-3 py-1 text-sm inline-block">Open full calendar</a>
          </div>
        </div>

        <div className="mt-5">
          {todos.length === 0 ? (
            <p className="text-sm text-slate-500">No tasks for today.</p>
          ) : (
            <div className="space-y-2">
              {todos.map((t: any) => (
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
          <div>
            <DashboardClient exportPath="/api/export?format=json" />
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
