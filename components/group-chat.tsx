'use client';

import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import { FormEvent, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button, Card } from './ui';

type Message = { id: string; authorId: string; authorName?: string; body: string; createdAt: string; updatedAt?: string };

export function GroupChat({ roadmapId, label = 'Group Chat', description = 'Talk with your group while working on the same roadmap.' }: { roadmapId: string; label?: string; description?: string }) {
  const [body,setBody]=useState('');
  const [sending,setSending]=useState(false);
  const {data,isLoading:loading}=useGetJsonQuery(
    {url:`/api/collab/${roadmapId}/messages`,tag:`chat:${roadmapId}`},
    {pollingInterval:15000},
  );
  const [request]=useRequestMutation();
  const messages=(((data as any)?.messages||[]) as Message[]);

  async function send(e:FormEvent){
    e.preventDefault();
    const value=body.trim();
    if(!value||sending)return;
    setSending(true);
    try{
      await request({url:`/api/collab/${roadmapId}/messages`,method:'POST',body:{body:value},invalidate:[`chat:${roadmapId}`,'notifications']}).unwrap();
      setBody('');
    }catch(err){alert(err instanceof Error?err.message:'Could not send message')}
    finally{setSending(false)}
  }
  return <Card className="p-5"><div className="flex items-center gap-2"><MessageCircle size={18}/><div><h2 className="font-semibold">{label}</h2><p className="text-xs text-slate-500">{description}</p></div></div><div className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[hsl(var(--line))] bg-slate-50/60 p-3 dark:bg-slate-950/30">{loading?<p className="py-8 text-center text-sm text-slate-500">Loading chat…</p>:messages.length?messages.map(m=><div key={m.id} className="rounded-lg border border-[hsl(var(--line))] bg-white p-2.5 text-sm dark:bg-slate-900"><div className="flex items-center justify-between gap-2"><span className="font-medium text-xs">{m.authorName || 'Member'}</span><time className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleString()}</time></div><p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p></div>):<p className="py-8 text-center text-sm text-slate-500">No messages yet. Start the conversation.</p>}</div><form onSubmit={send} className="mt-3 flex gap-2"><input value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} placeholder="Message your group…" className="min-w-0 flex-1 rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2.5 text-sm"/><Button type="submit" disabled={sending||!body.trim()}><Send size={14}/> {sending?'Sending…':'Send'}</Button></form></Card>;
}
