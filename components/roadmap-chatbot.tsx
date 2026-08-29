'use client';

import { useState } from 'react';
import { Bot, ExternalLink, Loader2, Send, Sparkles, X } from 'lucide-react';

type Recommendation = {
  kind: 'roadmap' | 'resource';
  roadmapId: string;
  roadmapTitle: string;
  title: string;
  description: string;
  url?: string;
  topicId?: string;
  topicTitle?: string;
};

type Message = { role: 'user' | 'assistant'; text: string; recommendations?: Recommendation[] };

export function RoadmapChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Ask me what you want to learn. I can recommend only public roadmaps and resources from the community.' },
  ]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput('');
    setMessages(current => [...current, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const response = await fetch('/api/chatbot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Unable to get recommendations');
      setMessages(current => [...current, { role: 'assistant', text: payload.reply, recommendations: payload.recommendations }]);
    } catch (error) {
      setMessages(current => [...current, { role: 'assistant', text: error instanceof Error ? error.message : 'Something went wrong.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] shadow-2xl shadow-slate-950/20">
          <div className="flex items-center justify-between border-b border-[hsl(var(--line))] bg-slate-950 px-4 py-3 text-white">
            <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Bot size={18}/></div><div><p className="text-sm font-semibold">Roadmap Assistant</p><p className="text-[11px] text-slate-300">Public content only</p></div></div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close assistant"><X size={16}/></button>
          </div>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div key={index} className={message.role === 'user' ? 'ml-10' : 'mr-3'}>
                <div className={`rounded-2xl px-3.5 py-3 text-sm ${message.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}>{message.text}</div>
                {message.recommendations?.length ? (
                  <div className="mt-2 space-y-2">
                    {message.recommendations.map((item, i) => (
                      <div key={`${item.kind}-${item.roadmapId}-${item.title}-${i}`} className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--card))] p-3">
                        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-indigo-600">{item.kind === 'roadmap' ? 'Public roadmap' : 'Resource'}</p><p className="mt-1 text-sm font-semibold">{item.title}</p>{item.topicTitle && <p className="mt-1 text-[11px] text-slate-500">Topic: {item.topicTitle} · {item.roadmapTitle}</p>}<p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.description}</p></div><Sparkles size={14} className="shrink-0 text-indigo-500"/></div>
                        {item.kind === 'roadmap' ? <a href={`/roadmap?roadmapId=${item.roadmapId}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">Open roadmap <ExternalLink size={12}/></a> : <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">Open resource <ExternalLink size={12}/></a>}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy && <div className="mr-3 rounded-2xl bg-slate-100 px-3.5 py-3 text-sm text-slate-500 dark:bg-slate-900"><span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin"/> Searching public roadmaps…</span></div>}
          </div>
          <form onSubmit={e => { e.preventDefault(); void send(); }} className="border-t border-[hsl(var(--line))] p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] px-3 py-2"><input value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. I want to learn system design" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/><button disabled={busy || !input.trim()} className="rounded-xl bg-indigo-600 p-2 text-white disabled:opacity-40" aria-label="Send"><Send size={15}/></button></div>
          </form>
        </div>
      )}
      <button onClick={() => setOpen(value => !value)} className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-slate-950/25 hover:bg-slate-800"><Bot size={17}/>{open ? 'Close' : 'Ask roadmap AI'}</button>
    </>
  );
}
