'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from './ui';
import { useState } from 'react';

export function SyncRoadmapButton({ onSync, compact = false }: { onSync: () => Promise<void> | void; compact?: boolean }) {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSynced(false);
    try {
      await onSync();
      setSynced(true);
      window.setTimeout(() => setSynced(false), 1800);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button variant="outline" size={compact ? 'sm' : 'default'} onClick={() => void handleSync()} disabled={syncing} title="Load the latest roadmap from the server">
      <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
      {syncing ? 'Syncing…' : synced ? 'Synced' : 'Sync latest'}
    </Button>
  );
}
