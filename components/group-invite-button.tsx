'use client';

import { useEffect, useState } from 'react';
import { useLazyGetJsonQuery } from '@/lib/redux/api';
import { Check, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui';

type User = { id: string; fullName: string; email: string };

type Props = {
  groupId: string;
  roadmapId: string;
  groupName: string;
  groupKind: 'team' | 'community';
  canInvite: boolean;
};

export function GroupInviteButton({ groupId, roadmapId, groupName, groupKind, canInvite }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [role, setRole] = useState<'viewer' | 'contributor' | 'editor'>('contributor');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [searchUsers, searchUsersState] = useLazyGetJsonQuery();
  const users = (((searchUsersState.data as any)?.users || []) as User[]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(() => {
      void searchUsers({
        url:`/api/users/search?q=${encodeURIComponent(q)}`,
        tag:`users:${q.toLowerCase()}`,
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, searchUsers]);

  if (!canInvite) return null;

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const invite = async () => {
    if (!selected.length || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const res = await fetch(`/api/collab/${roadmapId}/group/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selected, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not invite members.');
      setSelected([]);
      setQuery('');
      setNotice(`${data.added ?? selected.length} member${(data.added ?? selected.length) === 1 ? '' : 's'} added.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not invite members.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setNotice(''); }}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
        aria-label={`Invite members to ${groupName}`}
      >
        <UserPlus size={14} /> Invite / Add members
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label={`Invite members to ${groupName}`}>
          <div className="w-full max-w-xl rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Invite / Add members</h2>
                <p className="mt-1 text-xs text-slate-500">{groupKind === 'community' ? 'Community owners can grant collaboration access directly.' : 'Any team member can add friends directly.'}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Close"><X size={16} /></button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px]">
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email…" className="rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-sm" autoFocus />
              <select value={role} onChange={e => setRole(e.target.value as typeof role)} className="rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-sm">
                <option value="viewer">Viewer</option>
                <option value="contributor">Contributor</option>
                <option value="editor">Editor</option>
              </select>
            </div>

            {users.length > 0 && (
              <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1">
                {users.map(user => {
                  const active = selected.includes(user.id);
                  return <button key={user.id} type="button" onClick={() => toggle(user.id)} className={`flex items-center justify-between rounded-xl border p-3 text-left ${active ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-[hsl(var(--line))]'}`}>
                    <span><span className="block text-sm font-medium">{user.fullName}</span><span className="block text-xs text-slate-500">{user.email}</span></span>
                    {active ? <Check size={16} className="text-indigo-600" /> : <UserPlus size={16} className="text-slate-400" />}
                  </button>;
                })}
              </div>
            )}

            {selected.length > 0 && <div className="mt-3 text-xs text-slate-500">{selected.length} selected</div>}
            {notice && <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">{notice}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
              <Button onClick={() => void invite()} disabled={busy || !selected.length}>{busy ? 'Adding…' : 'Add selected'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
