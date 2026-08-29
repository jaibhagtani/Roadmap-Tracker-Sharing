import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { ensureBranchAccess, type BranchSnapshot } from '@/lib/collab-branch';
import { getRoadmapRole } from '@/lib/collab-access';

const schema = z.object({ branchId: z.string().uuid(), message: z.string().trim().min(1).max(200) });

export async function POST(req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const body = schema.parse(await req.json());
    const result = await withRls(user.id, async tx => {
      const branch = await tx.collabBranch.findFirst({ where: { id: body.branchId, roadmapId, status: 'open' } });
      if (!branch) throw new Error('NOT_FOUND');
      const role = await ensureBranchAccess(tx, user.id, branch);
      if (role !== 'owner' && role !== 'topic_editor') throw new Error('FORBIDDEN');
      const existing = await tx.collabCommit.findFirst({ where: { branchId: branch.id, status: 'pending' } });
      if (existing) throw new Error('A commit is already waiting for leader review');
      const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { ownerId: true, title: true } });
      if (!roadmap) throw new Error('NOT_FOUND');
      const commit = await tx.collabCommit.create({ data: { branchId: branch.id, authorId: user.id, message: body.message, baseVersion: branch.baseVersion, snapshot: branch.snapshot as unknown as BranchSnapshot, status: 'pending' } });
      if (roadmap.ownerId !== user.id) await tx.notification.create({ data: { userId: roadmap.ownerId, type: 'collab_commit_pushed', collabCommitId: commit.id, title: 'New commit awaiting review', body: `${user.email} pushed “${body.message}” to ${branch.name} on “${roadmap.title}”.` } });
      return commit;
    });
    return NextResponse.json({ commit: result }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

export async function GET(_req: Request, { params }: { params: Promise<{ roadmapId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId } = await params;
    const data = await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role === 'none') throw new Error('FORBIDDEN');
      const commits = await tx.collabCommit.findMany({ where: { branch: { roadmapId }, status: { in: ['pending','conflict'] } }, include: { branch: { select: { id: true, name: true, ownerId: true, rootTopicId: true, baseVersion: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
      return { commits, isLeader: role === 'owner' };
    });
    return NextResponse.json(data);
  } catch (e) { return errorResponse(e); }
}
