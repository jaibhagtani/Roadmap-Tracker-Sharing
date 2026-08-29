'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';

export function RequestCollaboration({ roadmapId }: { roadmapId: string }) {
  const [busy,setBusy]=useState(false); const [sent,setSent]=useState(false);
  async function request(){
    setBusy(true);
    const message = prompt('Optional message to the roadmap leader', 'I would like to collaborate on this roadmap.') ?? '';
    const r = await fetch(`/api/collab/${roadmapId}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message}) });
    setBusy(false);
    if (!r.ok) { alert(await r.text()); return; }
    setSent(true);
  }
  return <Button variant="outline" disabled={busy||sent} onClick={request}>{sent ? 'Request sent' : busy ? 'Sending…' : 'Request to collaborate'}</Button>;
}
