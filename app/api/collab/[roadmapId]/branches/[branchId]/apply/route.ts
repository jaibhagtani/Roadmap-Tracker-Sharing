import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { applySnapshotOperation, cloneSnapshot, ensureBranchAccess, type BranchSnapshot } from '@/lib/collab-branch';

const schema = z.object({ expectedVersion: z.number().int().nonnegative(), op: z.string().min(1), payload: z.record(z.string(), z.any()).default(() => ({})) });

export async function POST(req: Request, { params }: { params: Promise<{ roadmapId: string; branchId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId, branchId } = await params;
    const body = schema.parse(await req.json());
    const result = await withRls(user.id, async tx => {
      const branch = await tx.collabBranch.findFirst({ where: { id: branchId, roadmapId } });
      if (!branch) throw new Error('NOT_FOUND');
      const role = await ensureBranchAccess(tx, user.id, branch);
      if (role === 'none') throw new Error('FORBIDDEN');
      if (role !== 'owner' && role !== 'topic_editor') throw new Error('FORBIDDEN');
      if (branch.status !== 'open') throw new Error('BRANCH_CLOSED');
      if (branch.version !== body.expectedVersion) throw new Error('CONFLICT');
      const snapshot = cloneSnapshot(branch.snapshot as unknown as BranchSnapshot);
      const result = applySnapshotOperation(snapshot, body.op, body.payload, branch.rootTopicId);
      const updated = await tx.collabBranch.update({ where: { id: branch.id }, data: { snapshot: snapshot as any, version: { increment: 1 } }, select: { version: true } });
      return { ...result, roadmap: snapshot, version: updated.version };
    });
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
