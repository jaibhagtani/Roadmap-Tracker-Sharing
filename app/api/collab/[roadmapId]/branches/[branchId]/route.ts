import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { withRls, errorResponse } from '@/lib/db';
import { ensureBranchAccess, type BranchSnapshot } from '@/lib/collab-branch';

export async function GET(_req: Request, { params }: { params: Promise<{ roadmapId: string; branchId: string }> }) {
  try {
    const user = await requireUser();
    const { roadmapId, branchId } = await params;
    const data = await withRls(user.id, async tx => {
      const branch = await tx.collabBranch.findFirst({ where: { id: branchId, roadmapId } });
      if (!branch) throw new Error('NOT_FOUND');
      const role = await ensureBranchAccess(tx, user.id, branch);
      if (role === 'none') throw new Error('FORBIDDEN');
      return { branch: { id: branch.id, name: branch.name, ownerId: branch.ownerId, rootTopicId: branch.rootTopicId, baseVersion: branch.baseVersion, version: branch.version, status: branch.status, updatedAt: branch.updatedAt }, roadmap: branch.snapshot as unknown as BranchSnapshot, role };
    });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
