'use client';
import { useState } from 'react';
import { Copy, Link2, Mail, UserRound, X, Send, CheckCircle2, Globe2 } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';

export function ShareRoadmapDialog({ roadmapId, shareSlug, privacy, onPublic }: { roadmapId: string; shareSlug: string; privacy: 'private'|'link'|'public'; onPublic?: () => void }) {
  const [open,setOpen]=useState(false); const [mode,setMode]=useState<'friends'|'public'>('friends');
  const [identifier,setIdentifier]=useState(''); const [role,setRole]=useState<'viewer'|'contributor'>('contributor'); const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false); const [done,setDone]=useState(''); const [error,setError]=useState(''); const [copied,setCopied]=useState(false);
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/share/${shareSlug}` : `/share/${shareSlug}`;
  if (!open) return <Button variant="outline" onClick={()=>setOpen(true)}><Send size={14}/> Share</Button>;
  async function submit(e:React.FormEvent){
    e.preventDefault(); if(!identifier.trim()||busy)return; setBusy(true);setError('');setDone('');
    try{const r=await fetch(`/api/roadmaps/${roadmapId}/share-user`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:identifier.trim(),role,message})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not share this roadmap.');setDone(`Shared with ${j.user?.email||j.user?.id||'the user'}. They can open it from their notifications.`);setIdentifier('');setMessage('');}
    catch(err){setError(err instanceof Error?err.message:'Could not share this roadmap.')}finally{setBusy(false)}
  }
  async function makePublic(){
    if(busy || privacy==='public') return; setBusy(true); setError(''); setDone('');
    try { const r=await fetch(`/api/roadmaps/${roadmapId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({privacy:'public'})}); const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||'Could not enable the public view link.'); onPublic?.(); setDone('Public view link is ready. Anyone with the link can view this roadmap.'); }
    catch(err){setError(err instanceof Error?err.message:'Could not enable the public view link.')} finally{setBusy(false)}
  }
  async function copyPublic(){ try{await navigator.clipboard.writeText(publicUrl);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{setError('Could not copy the link.')} }
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Share roadmap">
    <Card className="w-full max-w-lg overflow-hidden p-0 shadow-2xl">
      <div className="flex items-start justify-between border-b border-[hsl(var(--line))] p-5"><div><div className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Share roadmap</div><h2 className="mt-1 text-xl font-semibold">Share with friends</h2><p className="mt-1 text-sm text-muted-foreground">Invite a specific Roadmap user, or create a public view link for everyone.</p></div><button className="rounded-lg p-2 text-muted-foreground hover:bg-muted" onClick={()=>setOpen(false)} aria-label="Close"><X size={18}/></button></div>
      <div className="grid grid-cols-2 border-b border-[hsl(var(--line))] p-1.5"><button type="button" onClick={()=>{setMode('friends');setError('');setDone('')}} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${mode==='friends'?'bg-primary text-primary-foreground':'text-muted-foreground hover:bg-muted'}`}><UserRound size={15} className="mr-1.5 inline"/>Share with friends</button><button type="button" onClick={()=>{setMode('public');setError('');setDone('')}} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${mode==='public'?'bg-primary text-primary-foreground':'text-muted-foreground hover:bg-muted'}`}><Globe2 size={15} className="mr-1.5 inline"/>Public view link</button></div>
      {mode==='friends' ? <form onSubmit={submit} className="space-y-5 p-5">
        <div><label className="text-sm font-medium">Email or User ID</label><div className="relative mt-1.5"><UserRound size={16} className="absolute left-3 top-3 text-muted-foreground"/><Input autoFocus value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="name@example.com or user ID" className="pl-9"/></div><p className="mt-1.5 text-xs text-muted-foreground">Only the selected account gets access. No password is required.</p></div>
        <div><label className="text-sm font-medium">Access</label><select value={role} onChange={e=>setRole(e.target.value as any)} className="mt-1.5 w-full rounded-xl border border-[hsl(var(--line))] bg-background px-3 py-2.5 text-sm"><option value="viewer">Viewer — can view</option><option value="contributor">Contributor — can collaborate</option></select></div>
        <div><label className="text-sm font-medium">Message <span className="font-normal text-muted-foreground">(optional)</span></label><textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={1000} placeholder="Add a short note…" className="mt-1.5 min-h-24 w-full resize-none rounded-xl border border-[hsl(var(--line))] bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"/></div>
        {error&&<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{done&&<div className="flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/><span>{done}</span></div>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Close</Button><Button type="submit" disabled={busy||!identifier.trim()}>{busy?'Sharing…':<><Mail size={14}/> Share with friend</>}</Button></div>
      </form> : <div className="space-y-5 p-5">
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4"><div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Link2 size={18}/></div><div><h3 className="text-sm font-semibold">Public view link</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Anyone with this link can view the roadmap. Public viewers cannot edit or collaborate from this link.</p></div></div></div>
        <div className="flex gap-2"><Input readOnly value={publicUrl} className="text-xs"/><Button type="button" variant="outline" onClick={()=>void copyPublic()}><Copy size={14}/> {copied?'Copied':'Copy'}</Button></div>
        {privacy!=='public' && <p className="text-xs text-muted-foreground">This roadmap is not public yet. Enable the public view before sharing this link.</p>}
        {error&&<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{done&&<div className="flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/><span>{done}</span></div>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Close</Button>{privacy!=='public'&&<Button type="button" onClick={()=>void makePublic()} disabled={busy}>{busy?'Enabling…':'Enable public view'}</Button>}{privacy==='public'&&<Button type="button" onClick={()=>void copyPublic()}><Copy size={14}/> Copy public link</Button>}</div>
      </div>}
    </Card>
  </div>;
}
