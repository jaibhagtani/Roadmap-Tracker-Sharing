import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { ensureBranchAccess, loadSnapshot } from '@/lib/collab-branch';
import { getRoadmapRole } from '@/lib/collab-access';

const createSchema = z.object({ name: z.string().trim().min(1).max(80), rootTopicId: z.string().uuid().nullable().default(null) });

export async function GET(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const data = await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role === 'none') throw new Error('FORBIDDEN');
      const [branches, commits] = await Promise.all([
        tx.collabBranch.findMany({ where: { roadmapId, status: 'open' }, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, ownerId: true, rootTopicId: true, baseVersion: true, version: true, status: true, createdAt: true, updatedAt: true } }),
        tx.collabCommit.findMany({ where: { branch: { roadmapId }, status: { in: ['pending','conflict'] } }, include: { branch: { select: { name: true, ownerId: true, rootTopicId: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      ]);
      return { role, branches, commits };
    });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const body = createSchema.parse(await req.json());
    const result = await withRls(user.id, async tx => {
      const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { id: true, ownerId: true, version: true } });
      if (!roadmap) throw new Error('NOT_FOUND');
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role === 'none') throw new Error('FORBIDDEN');
      if (body.rootTopicId && (await ensureBranchAccess(tx, user.id, { roadmapId, ownerId: roadmap.ownerId, rootTopicId: body.rootTopicId })) === 'none') throw new Error('FORBIDDEN');
      if (body.rootTopicId) {
        const root = await tx.topic.findFirst({ where: { id: body.rootTopicId, roadmapId }, select: { id: true } });
        if (!root) throw new Error('NOT_FOUND');
      }
      const snapshot = await loadSnapshot(tx, roadmapId, body.rootTopicId);
      const branch = await tx.collabBranch.create({ data: { roadmapId, ownerId: user.id, name: body.name, rootTopicId: body.rootTopicId, baseVersion: roadmap.version, snapshot: JSON.parse(JSON.stringify(snapshot)) } });
      return branch;
    });
    return NextResponse.json({ branch: result }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
