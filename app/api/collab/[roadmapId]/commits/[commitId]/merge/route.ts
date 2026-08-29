import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { getRoadmapRole, recordChange } from '@/lib/collab-access';
import { mergeSnapshot, type BranchSnapshot } from '@/lib/collab-branch';

export async function POST(_req: Request, { params }: { params: Promise<{ roadmapId: string; commitId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId, commitId } = await params;
    const result = await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role !== 'owner') throw new Error('LEADER_ONLY');
      const commit = await tx.collabCommit.findFirst({ where: { id: commitId, branch: { roadmapId } }, include: { branch: true } });
      if (!commit) throw new Error('NOT_FOUND');
      if (!['pending','conflict'].includes(commit.status)) throw new Error('COMMIT_ALREADY_HANDLED');
      const roadmap = await tx.roadmap.findUnique({ where: { id: roadmapId }, select: { version: true } });
      if (!roadmap) throw new Error('NOT_FOUND');
      if (roadmap.version !== commit.baseVersion) {
        await tx.collabCommit.update({ where: { id: commit.id }, data: { status: 'conflict' } });
        throw new Error('MERGE_CONFLICT');
      }
      await mergeSnapshot(tx, commit.snapshot as unknown as BranchSnapshot, commit.branch.rootTopicId);
      const change = await recordChange(tx, roadmapId, user.id, `merge:${commit.message}`, 'commit', commit.id, { commitId: commit.id, branchId: commit.branchId, authorId: commit.authorId });
      await tx.collabCommit.update({ where: { id: commit.id }, data: { status: 'merged', mergedAt: new Date(), mergedBy: user.id } });
      await tx.collabBranch.update({ where: { id: commit.branchId }, data: { status: 'merged' } });
      if (commit.authorId !== user.id) await tx.notification.create({ data: { userId: commit.authorId, type: 'collab_commit_merged', collabCommitId: commit.id, title: 'Commit merged', body: `Your commit “${commit.message}” was accepted by the roadmap leader.` } });
      return { ...change, commitId: commit.id };
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected server error';
    const status = message === 'MERGE_CONFLICT' ? 409 : undefined;
    return status ? new Response(message, { status }) : errorResponse(e);
  }
}
