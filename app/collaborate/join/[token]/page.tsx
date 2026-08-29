import { AppShell } from '@/components/app-shell';
import { JoinGroupClient } from '@/components/join-group-client';

export default async function JoinGroupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AppShell><JoinGroupClient token={token}/></AppShell>;
}
