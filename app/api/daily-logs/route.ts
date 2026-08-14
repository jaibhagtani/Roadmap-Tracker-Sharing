import { NextResponse } from 'next/server';
import { withRls } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { z } from 'zod';

const schema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  studyMinutes: z.number().int().min(0).max(1440).default(0),
  topicsStudied: z.array(z.string().max(255)).max(500).default([]),
  resourcesCompleted: z.number().int().min(0).max(100000).default(0),
  problemsSolved: z.number().int().min(0).max(100000).default(0),
  learned: z.string().max(10000).default(''),
  difficulties: z.string().max(10000).default(''),
  tomorrowGoal: z.string().max(5000).default(''),
});

function dateOnly(s: string) { return new Date(`${s}T00:00:00.000Z`); }

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const todayParam = searchParams.get('today');
  const logs = await withRls(user.id, tx => tx.dailyLog.findMany({
    where: { ownerId: user.id, ...(from || to ? { logDate: { ...(from ? { gte: dateOnly(from) } : {}), ...(to ? { lte: dateOnly(to) } : {}) } } : {}) },
    orderBy: { logDate: 'asc' },
  }));
  const allLogs = await withRls(user.id, tx => tx.dailyLog.findMany({
    where: { ownerId: user.id },
    orderBy: { logDate: 'asc' },
  }));
  const active = allLogs.filter(x => x.studyMinutes > 0 || x.resourcesCompleted > 0 || x.problemsSolved > 0).map(x => x.logDate.toISOString().slice(0, 10));
  let longest = 0, current = 0;
  const set = new Set(active);
  const sorted = [...set].sort();
  for (let i = 0; i < sorted.length; i += 1) {
    if (i === 0 || (Date.parse(`${sorted[i]}T00:00:00Z`) - Date.parse(`${sorted[i - 1]}T00:00:00Z`)) === 86400000) current += 1;
    else current = 1;
    longest = Math.max(longest, current);
  }
  let cursor = todayParam ? dateOnly(todayParam) : new Date(); cursor.setUTCHours(0, 0, 0, 0); current = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) { current += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return NextResponse.json({ logs, stats: { totalStudyMinutes: allLogs.reduce((s, x) => s + x.studyMinutes, 0), activeDays: active.length, longestStreak: longest, currentStreak: current } });
}

export async function PUT(req: Request) {
  const user = await requireUser();
  const input = schema.parse(await req.json());
  const logDate = dateOnly(input.logDate);
  const log = await withRls(user.id, tx => tx.dailyLog.upsert({
    where: { ownerId_logDate: { ownerId: user.id, logDate } },
    create: { ownerId: user.id, logDate, studyMinutes: input.studyMinutes, topicsStudied: input.topicsStudied, resourcesCompleted: input.resourcesCompleted, problemsSolved: input.problemsSolved, learned: input.learned, difficulties: input.difficulties, tomorrowGoal: input.tomorrowGoal },
    update: { studyMinutes: input.studyMinutes, topicsStudied: input.topicsStudied, resourcesCompleted: input.resourcesCompleted, problemsSolved: input.problemsSolved, learned: input.learned, difficulties: input.difficulties, tomorrowGoal: input.tomorrowGoal },
  }));
  return NextResponse.json({ log });
}
