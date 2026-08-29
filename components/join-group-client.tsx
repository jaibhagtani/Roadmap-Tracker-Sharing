'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card } from './ui';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';

type GroupData = {
  group: { id: string; name: string; description: string; maxMembers: number; roadmapId: string; settings: any; roadmap: { title: string } };
  memberCount: number;
  membership: { role: string } | null;
  pending?: boolean;
};

export function JoinGroupClient({ token }: { token: string }) {
  const router = useRouter();
  const {data: queryData,isLoading:loading,error:queryError}=useGetJsonQuery({url:`/api/collab/group/join/${token}`,tag:`group-invite:${token}`});
  const data=(queryData as GroupData | undefined)||null;
  const [joining,setJoining]=useState(false);
  const [error,setError]=useState('');
  const [request]=useRequestMutation();

  async function join() {
    setJoining(true); setError('');
    try {
      const j:any = await request({url:`/api/collab/group/join/${token}`,method:'POST',invalidate:[`group-invite:${token}`,'notifications','communities']}).unwrap();
      router.push(j.pending ? `/collaborate/${j.roadmapId}#community` : `/collaborate/${j.roadmapId}#group-chat`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join this group.');
      setJoining(false);
    }
  }


  if (loading) return <Card className="mx-auto max-w-xl p-8 text-center"><div className="animate-pulse text-sm text-slate-500">Loading group invitation…</div></Card>;
  if (error || queryError || !data) return <Card className="mx-auto max-w-xl p-8 text-center"><h1 className="text-2xl font-bold">Invite not available</h1><p className="mt-2 text-sm text-slate-500">{error || 'This invitation is no longer valid.'}</p></Card>;

  const { group, memberCount, membership } = data;
  const kind = group.settings?.kind === 'community' ? 'community' : 'team';
  const direct = group.settings?.directCollaboration === true;

  return <div className="mx-auto max-w-xl">
    <Card className="p-7">
      <Badge>Group invitation</Badge>
      <h1 className="mt-4 text-3xl font-bold">Join {group.name}</h1>
      <p className="mt-2 text-slate-500">{group.description || 'A study group collaborating on a shared roadmap.'}</p>
      <div className="mt-5 rounded-xl border border-[hsl(var(--line))] p-4">
        <div className="font-semibold">{group.roadmap.title}</div>
        <div className="mt-1 text-xs text-slate-500">{memberCount}/{group.maxMembers} members · {kind === 'community' ? 'community · approved members can collaborate directly' : direct ? 'direct collaboration enabled' : 'review-based collaboration'}</div>
      </div>
      {membership ? <div className="mt-5"><p className="text-sm text-emerald-600">You are already a member as {membership.role}.</p><Button className="mt-3" onClick={() => router.push(kind === 'community' ? `/community-activity/${group.id}` : `/team-activity/${group.id}`)}>Open group workspace</Button></div> : data.pending ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">Your collaboration request is pending. The community owner must approve access before you can edit the roadmap.</div> : <Button className="mt-5 w-full justify-center" disabled={joining || (kind === 'team' && memberCount >= group.maxMembers)} onClick={join}>{joining ? 'Sending…' : kind === 'community' ? 'Request to join' : memberCount >= group.maxMembers ? 'Group is full' : 'Join team'}</Button>}
    </Card>
  </div>;
}
