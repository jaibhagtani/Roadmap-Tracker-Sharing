import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { getRoadmapRole } from '@/lib/collab-access';

export async function POST(_req: Request, { params }: { params: Promise<{ roadmapId: string; commitId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId, commitId } = await params;
    const result = await withRls(user.id, async tx => {
      const role = await getRoadmapRole(tx, user.id, roadmapId);
      if (role !== 'owner') throw new Error('LEADER_ONLY');
      const commit = await tx.collabCommit.findFirst({ where: { id: commitId, branch: { roadmapId } } });
      if (!commit) throw new Error('NOT_FOUND');
      const updated = await tx.collabCommit.update({ where: { id: commit.id }, data: { status: 'rejected' } });
      if (commit.authorId !== user.id) await tx.notification.create({ data: { userId: commit.authorId, type: 'collab_commit_rejected', collabCommitId: commit.id, title: 'Commit rejected', body: `Your commit “${commit.message}” was rejected by the roadmap leader.` } });
      return updated;
    });
    return NextResponse.json({ commit: result });
  } catch (e) { return errorResponse(e); }
}
