export async function findGroupForRoadmap<T extends { roadmapId: string; settings: unknown }>(tx: any, roadmapId: string, select?: any): Promise<T | null> {
  const direct = await tx.collabGroup.findUnique({ where: { roadmapId }, select });
  if (direct) return direct as T;
  const groups = await tx.collabGroup.findMany({ select: select || undefined, take: 200 });
  return (groups as T[]).find(group => {
    const settings = (group.settings as any) || {};
    return Array.isArray(settings.roadmapIds) && settings.roadmapIds.includes(roadmapId);
  }) || null;
}
