'use client';
import React, { useRef } from 'react';
import { Button } from './ui';

export default function DashboardClient({ exportPath = '/api/export?format=json' }: { exportPath?: string }) {
  const file = useRef<HTMLInputElement | null>(null);

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const payload = JSON.parse(await f.text());
      const r = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(await r.text());
      alert('Roadmap imported successfully.');
    } catch (err: any) {
      alert(err?.message || 'Import failed');
    }
    if (file.current) file.current.value = '';
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={importFile} />
      <Button variant="outline" onClick={() => file.current?.click()}>Import JSON</Button>
      <Button onClick={() => { location.href = exportPath; }}>Export JSON</Button>
      <Button variant="outline" onClick={() => { location.href = `${exportPath.replace('?format=json','?format=markdown')}`; }}>Export Markdown</Button>
    </div>
  );
}
