'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import {
  Bell, CalendarDays, ChevronDown, GitBranch, Globe2, LayoutDashboard, LogOut,
  Menu, Moon, Search, Settings, Sparkles, Sun, Users, X, Plus, CircleDot, CheckSquare2,
  CalendarPlus, UserPlus, Network,
} from 'lucide-react';

const navGroups = [
  {
    label: 'Roadmaps',
    items: [
      ['/dashboard', 'Dashboard', LayoutDashboard],
      ['/roadmap', 'My Roadmaps', GitBranch],
      ['/shared', 'Shared with me', Globe2],
    ],
  },
  {
    label: 'Community',
    items: [
      ['/community', 'Community Roadmaps', Globe2],
      ['/collaborate', 'Teams & Communities', Users],
    ],
  },
] as const;

function active(path: string, current: string) {
  return current === path || current.startsWith(`${path}/`);
}

export function AppBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onePage = pathname === '/roadmap' && searchParams.get('view') === 'one-page';
  const roadmapId = searchParams.get('roadmapId');
  const studioHref = roadmapId ? `/roadmap?roadmapId=${encodeURIComponent(roadmapId)}` : '/roadmap';
  const onePageHref = roadmapId ? `/roadmap?roadmapId=${encodeURIComponent(roadmapId)}&view=one-page` : '/roadmap?view=one-page';
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { data: meData } = useGetJsonQuery({ url: '/api/me', tag: 'me' });
  const { data: notificationData, isFetching: notificationLoading } = useGetJsonQuery({ url: '/api/notifications', tag: 'notifications' }, { pollingInterval: 300000 });
  const [request] = useRequestMutation();

  const userName =
    (meData as any)?.profile?.fullName ||
    (meData as any)?.user?.email?.split('@')[0] ||
    'Account';
  const notifications = ((notificationData as any)?.notifications || []) as any[];
  const unread = notifications.filter((n: any) => !n.readAt).length;

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const respondToNotification = async (notificationId:string, action:'accept'|'reject') => {
    try {
      await request({
        url: '/api/notifications/action',
        method: 'POST',
        body: { notificationId, action },
        invalidate: ['notifications'],
      }).unwrap();
      window.dispatchEvent(new Event('app:sync'));
    } catch (e) { alert(e instanceof Error ? e.message : 'Could not process request.'); }
  };

  const isActionableNotification = (n:any) => ['collab_group_join_request','collab_join_request','share_request','collab_commit_pushed','team_join_request','community_join_request'].includes(n.type) && !n.readAt;
  const openNotificationRoadmap=(id:string)=>{window.location.href=`/roadmap/${id}/live`};
  const cloneNotificationRoadmap=async(id:string)=>{try{const j:any=await request({url:'/api/notifications/clone',method:'POST',body:{notificationId:id},invalidate:['notifications']}).unwrap();window.location.href=`/roadmap/${j.roadmap.id}`;}catch(e){alert(e instanceof Error?e.message:'Could not clone roadmap.')}};

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('theme', next);
    setTheme(next);
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error('Logout failed');
    } catch {} finally {
      window.location.assign('/auth/login');
    }
  }

  return (
    <>
      <header className="app-bar">
        <div className="app-bar-inner">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/dashboard" className="app-logo" aria-label="Roadmap home">
              <span className="app-logo-mark">RS</span>
              <span className="hidden xl:inline">Roadmap-Sharing</span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              {navGroups.map((group) => (
                <div key={group.label} className="app-menu-wrap">
                  <button className={`app-bar-link ${group.items.some(([href]) => active(href, pathname)) ? 'is-active' : ''}`} onClick={() => setOpen(open === group.label ? null : group.label)}>
                    {group.label} <ChevronDown size={14} />
                  </button>
                  {open === group.label && (
                    <div className="app-dropdown wide-dropdown">
                      <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">{group.label}</div>
                      {group.items.map(([href, label, Icon]) => (
                        <Link key={href} href={href} className="app-dropdown-item" onClick={() => setOpen(null)}>
                          <span className="app-dropdown-icon"><Icon size={16}/></span>
                          <span><strong>{label}</strong><small>{href === '/community' ? 'Discover public roadmaps and teams' : href === '/collaborate' ? 'Direct shared roadmap collaboration' : href === '/roadmap' ? 'Build your visual roadmap' : 'Manage your learning workspace'}</small></span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <Link className={`app-bar-link ${active('/calendar', pathname) ? 'is-active' : ''}`} href="/calendar"><CalendarDays size={15}/> Calendar</Link>
              <Link className={`app-bar-link ${active('/collaborate', pathname) ? 'is-active' : ''}`} href="/collaborate"><Users size={15}/> Teams</Link>
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <Link href="/community" className="app-icon-button hidden md:grid" title="Community Roadmaps"><Globe2 size={17}/></Link>
            <div className="relative">
              <button className="app-icon-button relative" title="Notifications" onClick={() => setNotificationOpen(v => !v)}>
                <Bell size={17}/>
                {unread > 0 && <span className="app-notification-dot">{unread > 9 ? '9+' : unread}</span>}
              </button>
              {notificationOpen && <div className="app-dropdown notification-dropdown">
                <div className="flex items-center justify-between px-3 py-2"><div className="text-xs font-semibold">Notifications</div><Link href="/notifications" className="text-[10px] font-semibold text-indigo-600" onClick={()=>setNotificationOpen(false)}>View all</Link></div>
                <div className="max-h-80 overflow-auto border-t border-[hsl(var(--line))]">
                  {notificationLoading ? <div className="p-5 text-center text-xs text-slate-500">Refreshing notifications…</div> : notifications.length ? notifications.slice(0,8).map((n:any)=><div key={n.id} className="border-b border-[hsl(var(--line))] px-3 py-3 last:border-0"><div className="flex gap-2"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt?'bg-slate-300':'bg-indigo-600'}`}/><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{n.title}</div><div className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] leading-4 text-slate-500">{n.body}</div>{n.roadmapId&&<div className="mt-2 flex flex-wrap gap-1.5"><button className="rounded-md border border-[hsl(var(--line))] px-2.5 py-1.5 text-[10px] font-semibold hover:bg-[hsl(var(--bg))]" onClick={()=>openNotificationRoadmap(n.roadmapId)}>Open roadmap</button><button className="rounded-md border border-[hsl(var(--line))] px-2.5 py-1.5 text-[10px] font-semibold hover:bg-[hsl(var(--bg))]" onClick={()=>void cloneNotificationRoadmap(n.id)}>Clone</button>{n.roadmapPrivacy!=='public'&&!isActionableNotification(n)&&<button className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-indigo-700" onClick={()=>openNotificationRoadmap(n.roadmapId)}>Collaborate</button>}</div>}{isActionableNotification(n)&&<div className="mt-2 flex gap-2"><button className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-indigo-700" onClick={()=>void respondToNotification(n.id,'accept')}>Approve</button><button className="rounded-md border border-[hsl(var(--line))] px-2.5 py-1.5 text-[10px] font-semibold hover:bg-[hsl(var(--bg))]" onClick={()=>void respondToNotification(n.id,'reject')}>Reject</button></div>} {!n.readAt&&!isActionableNotification(n)&&<button className="mt-2 text-[10px] font-semibold text-indigo-600" onClick={()=>{void request({url:'/api/notifications',method:'PATCH',body:{id:n.id},invalidate:['notifications']}).unwrap()}}>Mark read</button>}</div></div></div>) : <div className="p-5 text-center text-xs text-slate-500">You’re all caught up.</div>}
                </div>
              </div>}
            </div>
            <div className="app-view-switch hidden md:flex" aria-label="Roadmap view">
              <Link href={studioHref} className={!onePage ? 'is-active' : ''} title="Full editor">Studio</Link>
              <Link href={onePageHref} className={onePage ? 'is-active' : ''} title="One-page workspace">1-page</Link>
            </div>
            <div className="app-theme-switch hidden sm:flex" aria-label="Theme">
              <button onClick={() => theme !== 'light' && toggleTheme()} className={theme === 'light' ? 'is-active' : ''} title="Light theme"><Sun size={14}/></button>
              <button onClick={() => theme !== 'dark' && toggleTheme()} className={theme === 'dark' ? 'is-active' : ''} title="Dark theme"><Moon size={14}/></button>
            </div>
            <div className="hidden xl:flex items-center gap-1.5" aria-label="Create collaboration">
              <Link href="/collaborate/create?type=team" className="app-create-secondary" title="Create a private friends team">
                <UserPlus size={13}/> <span>Team</span>
              </Link>
              <Link href="/collaborate/create?type=community" className="app-create-secondary app-create-secondary-community" title="Create a public community">
                <Network size={13}/> <span>Community</span>
              </Link>
            </div>
            <div className="relative">
              {/* <button className="app-create-button" onClick={() => setAddOpen(v => !v)} aria-expanded={addOpen}>
                <Plus size={14}/> <span>Add</span><ChevronDown size={13}/>
              </button> */}
              {addOpen && (
                <div className="app-dropdown add-dropdown">
                  <Link href="/roadmap" className="app-dropdown-item" onClick={() => setAddOpen(false)}><span className="app-dropdown-icon"><Sparkles size={16}/></span><span><strong>Roadmap Studio</strong><small>Open the full visual roadmap editor</small></span></Link>
                  <Link href="/roadmap?view=one-page" className="app-dropdown-item" onClick={() => setAddOpen(false)}><span className="app-dropdown-icon"><LayoutDashboard size={16}/></span><span><strong>1-page workspace</strong><small>Roadmap, calendar, tasks and sharing in one page</small></span></Link>
                  <Link href="/roadmap?action=topic" className="app-dropdown-item" onClick={() => setAddOpen(false)}><span className="app-dropdown-icon"><CircleDot size={16}/></span><span><strong>Topic</strong><small>Add a topic to your roadmap</small></span></Link>
                  <Link href="/calendar?newTask=1" className="app-dropdown-item" onClick={() => setAddOpen(false)}><span className="app-dropdown-icon"><CalendarPlus size={16}/></span><span><strong>Task</strong><small>Add a dated learning task</small></span></Link>
                  <Link href="/collaborate/create?type=team" className="app-dropdown-item" onClick={() => setAddOpen(false)}><span className="app-dropdown-icon"><UserPlus size={16}/></span><span><strong>Create Team</strong><small>Choose a roadmap and create its owner-managed team</small></span></Link>
                  <Link href="/collaborate/create?type=community" className="app-dropdown-item" onClick={() => setAddOpen(false)}><span className="app-dropdown-icon"><Network size={16}/></span><span><strong>Create Community</strong><small>Create an owner-managed community for a roadmap</small></span></Link>
                  <Link href="/community" className="app-dropdown-item" onClick={() => setAddOpen(false)}><span className="app-dropdown-icon"><Globe2 size={16}/></span><span><strong>Community Roadmaps</strong><small>Discover public roadmaps and teams</small></span></Link>
                </div>
              )}
            </div>
            <button className="app-account" onClick={() => setOpen(open === 'account' ? null : 'account')}>
              <span className="app-avatar">{userName.slice(0, 1).toUpperCase()}</span><span className="hidden sm:inline max-w-24 truncate">{userName}</span><ChevronDown size={14}/>
            </button>
            {open === 'account' && (
              <div className="app-dropdown account-dropdown">
                <Link href="/settings" className="app-dropdown-simple"><Settings size={15}/> Settings</Link>
                <button onClick={toggleTheme} className="app-dropdown-simple">{theme === 'dark' ? <Sun size={15}/> : <Moon size={15}/>} {theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
                <button onClick={logout} disabled={loggingOut} className="app-dropdown-simple text-red-500 disabled:opacity-60"><LogOut size={15}/> {loggingOut ? 'Logging out…' : 'Logout'}</button>
              </div>
            )}
            <button className="app-menu-trigger lg:hidden" onClick={() => setMobile(!mobile)}>{mobile ? <X size={18}/> : <Menu size={18}/>}</button>
          </div>
        </div>
        {mobile && (
          <div className="app-mobile-panel lg:hidden">
            <div className="app-mobile-search"><Search size={16}/><input placeholder="Search roadmaps, topics, resources…" /></div>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/dashboard" className="app-mobile-link"><LayoutDashboard size={15}/> Dashboard</Link>
              <Link href="/roadmap" className="app-mobile-link"><GitBranch size={15}/> My Roadmaps</Link>
              <Link href="/community" className="app-mobile-link"><Globe2 size={15}/> Community Roadmaps</Link>
              <Link href="/collaborate" className="app-mobile-link"><Users size={15}/> Teams & Communities</Link>
              <Link href="/collaborate/create?type=team" className="app-mobile-link"><UserPlus size={15}/> Create Team</Link>
              <Link href="/collaborate/create?type=community" className="app-mobile-link"><Network size={15}/> Create Community</Link>
              <Link href="/calendar" className="app-mobile-link"><CalendarDays size={15}/> Calendar</Link>
              
              <Link href="/notifications" className="app-mobile-link"><Bell size={15}/> Notifications</Link>
            </div>
          </div>
        )}
      </header>
      {(open || addOpen) && <button aria-label="Close menu" className="app-menu-backdrop" onClick={() => { setOpen(null); setAddOpen(false); }} />}
    </>
  );
}
