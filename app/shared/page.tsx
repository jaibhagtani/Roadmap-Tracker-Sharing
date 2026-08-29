'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import { AppShell } from '@/components/app-shell';
import { Card, Button, Badge } from '@/components/ui';
import { Bell, CheckCircle2, Clock3, ExternalLink, Inbox, Loader2, MessageCircle, Send, Share2, Users, XCircle } from 'lucide-react';

type Req = {
  id: string;
  status: string;
  message: string;
  createdAt: string;
  scopeType: 'roadmap' | 'topic' | 'template';
  requestType?: 'share' | 'join';
  role: 'contributor' | 'editor' | 'viewer';
  roadmapId: string | null;
  rootTopicId: string | null;
  templateId: string | null;
  senderId: string;
  receiverId: string;
  roadmap?: { id: string; title: string; description: string };
  rootTopic?: { id: string; title: string };
  template?: { id: string; name: string; description: string };
};

type Notification = { id: string; title: string; body: string; readAt: string | null; createdAt: string };

type SharedData = {
  roadmaps: any[];
  topics: any[];
  templates: any[];
};

type Section = 'requests' | 'shared' | 'notifications' | 'sent';

const sectionMeta: Record<Section, { label: string; icon: typeof Inbox; description: string }> = {
  requests: { label: 'Requests', icon: Inbox, description: 'Approve, reject or clone access requests.' },
  shared: { label: 'Shared with me', icon: Share2, description: 'Open roadmaps you can view or collaborate on.' },
  notifications: { label: 'Notifications', icon: Bell, description: 'Recent invitations, access updates and collaboration alerts.' },
  sent: { label: 'Sent', icon: Send, description: 'Track requests you have sent.' },
};

export default function Shared() {
  const [active, setActive] = useState<Section>('requests');
  const [search, setSearch] = useState('');
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [requestAction] = useRequestMutation();

  const receivedQuery = useGetJsonQuery({ url: '/api/share-requests', tag: 'share-requests-received' });
  const sentQuery = useGetJsonQuery({ url: '/api/share-requests?sent=1', tag: 'share-requests-sent' });
  const notificationsQuery = useGetJsonQuery({ url: '/api/notifications', tag: 'notifications' });
  const sharedQuery = useGetJsonQuery({ url: '/api/shared/mine', tag: 'shared-mine' });

  const received = (((receivedQuery.data as any)?.items ?? []) as Req[]);
  const sent = (((sentQuery.data as any)?.items ?? []) as Req[]);
  const notifications = (((notificationsQuery.data as any)?.notifications ?? []) as Notification[]);
  const shared = ((sharedQuery.data as SharedData | undefined) ?? { roadmaps: [], topics: [], templates: [] });
  const loading = [receivedQuery, sentQuery, notificationsQuery, sharedQuery].some((q) => q.isLoading);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);
  const requestCount = useMemo(() => received.filter((r) => r.status === 'pending').length, [received]);

  async function action(id: string, actionType: 'accept' | 'reject') {
    try {
      await requestAction({
        url: `/api/share-requests/${id}`,
        method: 'POST',
        body: { action: actionType },
        invalidate: ['share-requests-received', 'share-requests-sent', 'notifications', 'shared-mine'],
      }).unwrap();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Request failed');
    }
  }

  async function clone(id: string) {
    if (cloningId) return;
    setCloningId(id);
    try {
      const result:any = await requestAction({
        url: `/api/share-requests/${id}/clone`,
        method: 'POST',
        body: {},
        invalidate: ['share-requests-received', 'shared-mine', 'roadmaps'],
      }).unwrap();
      location.href = `/roadmap?roadmapId=${result.roadmap.id}`;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unable to clone');
    } finally {
      setCloningId(null);
    }
  }

  async function markRead() {
    try {
      await requestAction({
        url: '/api/notifications',
        method: 'PATCH',
        body: {},
        invalidate: ['notifications'],
      }).unwrap();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unable to mark notifications read');
    }
  }

  function label(request: Req) {
    if (request.scopeType === 'topic') return `Topic: ${request.rootTopic?.title || request.rootTopicId}`;
    if (request.scopeType === 'template') return `Template: ${request.template?.name || request.templateId}`;
    return `Roadmap: ${request.roadmap?.title || request.roadmapId}`;
  }

  const filteredShared = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shared;
    return {
      roadmaps: shared.roadmaps.filter((x) => `${x.roadmap?.title || ''} ${x.roadmap?.description || ''}`.toLowerCase().includes(q)),
      topics: shared.topics.filter((x) => `${x.topic?.title || ''} ${x.topic?.roadmap?.title || ''}`.toLowerCase().includes(q)),
      templates: shared.templates.filter((x) => `${x.template?.name || ''} ${x.template?.description || ''}`.toLowerCase().includes(q)),
    };
  }, [search, shared]);

  const SectionIcon = sectionMeta[active].icon;

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-100px)]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300"><Users size={14} /> Collaboration</div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Shared</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">One place for requests, shared roadmaps and notifications. Open a roadmap to chat or collaborate.</p>
          </div>
          <a href="/roadmap" className="text-sm font-semibold text-indigo-600 hover:underline">Browse roadmaps →</a>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-[hsl(var(--line))] bg-slate-50/70 px-3 py-3 dark:bg-slate-950/40 md:px-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(Object.keys(sectionMeta) as Section[]).map((key) => {
                  const Icon = sectionMeta[key].icon;
                  const count = key === 'requests' ? requestCount : key === 'notifications' ? unreadCount : undefined;
                  return (
                    <button key={key} type="button" onClick={() => setActive(key)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${active === key ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300' : 'text-slate-500 hover:bg-white/80 hover:text-slate-800 dark:hover:bg-slate-900/70 dark:hover:text-slate-200'}`}>
                      <Icon size={15} /> {sectionMeta[key].label}
                      {count ? <Badge>{count}</Badge> : null}
                    </button>
                  );
                })}
              </div>
              {active === 'shared' && (
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shared roadmaps…" className="w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none ring-indigo-300 focus:ring-2 lg:w-72" />
              )}
            </div>
          </div>

          <div className="border-b border-[hsl(var(--line))] px-4 py-3">
            <div className="flex items-center gap-2"><SectionIcon size={16} className="text-indigo-600" /><div><p className="text-sm font-semibold">{sectionMeta[active].label}</p><p className="text-xs text-slate-500">{sectionMeta[active].description}</p></div></div>
          </div>

          <div className="max-h-[calc(100vh-250px)] min-h-[420px] overflow-y-auto p-4 md:p-5">
            {loading ? <div className="grid min-h-[380px] place-items-center text-sm text-slate-500"><span className="studio-spinner mr-2" />Loading collaboration…</div> : active === 'requests' ? (
              <div className="space-y-3">
                {received.length ? received.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-[hsl(var(--line))] p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{label(r)}</p><Badge>{r.requestType === 'join' ? 'Join request' : r.scopeType}</Badge><Badge>{r.role}</Badge><Badge>{r.status}</Badge></div><p className="mt-1 text-sm text-slate-500">{r.message || 'No message provided.'}</p><p className="mt-2 text-xs text-slate-400">From {r.senderId} · {new Date(r.createdAt).toLocaleString()}</p></div>
                      <div className="flex shrink-0 flex-wrap gap-2"><Button onClick={() => action(r.id, 'accept')}><CheckCircle2 size={14} /> Accept</Button><Button variant="outline" onClick={() => clone(r.id)} disabled={cloningId !== null}><Loader2 size={14} className={cloningId === r.id ? 'animate-spin' : 'hidden'} />{cloningId === r.id ? 'Cloning…' : 'Clone'}</Button><Button variant="outline" onClick={() => action(r.id, 'reject')}><XCircle size={14} /> Reject</Button></div>
                    </div>
                  </div>
                )) : <Empty icon={Inbox} title="No requests" text="You're all caught up." />}
              </div>
            ) : active === 'shared' ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredShared.roadmaps.map((x: any) => <SharedCard key={`r-${x.id}`} title={x.roadmap.title} subtitle={x.roadmap.description} label={`Roadmap · ${x.role}`} view={`/shared/view/${x.roadmap.id}`} collaborate={`/collaborate/${x.roadmap.id}`} />)}
                  {filteredShared.topics.map((x: any) => <SharedCard key={`t-${x.id}`} title={x.topic.title} subtitle={`From ${x.topic.roadmap.title}`} label={`Topic · ${x.role}`} view={`/shared/view/${x.topic.roadmap.id}`} collaborate={`/collaborate/${x.topic.roadmap.id}`} />)}
                </div>
                {filteredShared.templates.length ? <div className="border-t border-[hsl(var(--line))] pt-5"><div className="mb-3 flex items-center justify-between"><div><p className="font-semibold">Templates shared with me</p><p className="text-xs text-slate-500">Clone a template to create an independent roadmap.</p></div><Badge>{filteredShared.templates.length}</Badge></div><div className="grid gap-3 md:grid-cols-2">{filteredShared.templates.map((x: any) => <div key={x.id} className="rounded-2xl border border-[hsl(var(--line))] p-4"><p className="font-semibold">{x.template.name}</p><p className="mt-1 text-sm text-slate-500">{x.template.description || 'Shared template'}</p></div>)}</div></div> : null}
                {!filteredShared.roadmaps.length && !filteredShared.topics.length && !filteredShared.templates.length && <Empty icon={Share2} title="Nothing shared yet" text={search ? 'Try a different search.' : 'Shared roadmaps and topics will appear here.'} />}
              </div>
            ) : active === 'notifications' ? (
              <div className="space-y-3">
                <div className="flex justify-end"><Button variant="outline" onClick={markRead} disabled={!unreadCount}>Mark all read</Button></div>
                {notifications.length ? notifications.map((n) => <div key={n.id} className={`rounded-2xl border p-4 ${n.readAt ? 'border-[hsl(var(--line))]' : 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/20'}`}><div className="flex items-start gap-3"><Bell size={16} className="mt-0.5 text-indigo-600" /><div className="min-w-0 flex-1"><p className="font-semibold">{n.title}</p><p className="mt-1 text-sm text-slate-500">{n.body}</p><p className="mt-2 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p></div>{!n.readAt && <Badge>New</Badge>}</div></div>) : <Empty icon={Bell} title="No notifications" text="New collaboration activity will appear here." />}
              </div>
            ) : (
              <div className="space-y-3">
                {sent.length ? sent.map((r) => <div key={r.id} className="rounded-2xl border border-[hsl(var(--line))] p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{label(r)}</p><Badge>{r.role}</Badge><Badge>{r.status}</Badge></div><p className="mt-1 text-xs text-slate-500">To {r.receiverId} · {new Date(r.createdAt).toLocaleString()}</p></div><a href={r.roadmapId ? `/shared/view/${r.roadmapId}` : '#'} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline"><ExternalLink size={14} /> Open</a></div></div>) : <Empty icon={Send} title="No sent requests" text="Requests you send will appear here." />}
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function SharedCard({ title, subtitle, label, view, collaborate }: { title: string; subtitle: string; label: string; view: string; collaborate: string }) {
  return <div className="rounded-2xl border border-[hsl(var(--line))] p-4 transition hover:-translate-y-0.5 hover:shadow-sm"><div className="flex items-center justify-between gap-2"><Badge>{label}</Badge><Clock3 size={15} className="text-slate-400" /></div><p className="mt-3 truncate font-semibold">{title}</p><p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">{subtitle || 'Shared learning roadmap'}</p><div className="mt-4 flex flex-wrap gap-2"><a href={view} className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--line))] px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"><ExternalLink size={13} /> Live view</a><a href={collaborate} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"><MessageCircle size={13} /> Collaborate</a></div></div>;
}

function Empty({ icon: Icon, title, text }: { icon: typeof Inbox; title: string; text: string }) {
  return <div className="grid min-h-60 place-items-center rounded-2xl border border-dashed border-[hsl(var(--line))] p-8 text-center"><div><div className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-900"><Icon size={18} /></div><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div></div>;
}
