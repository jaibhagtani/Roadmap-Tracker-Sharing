import { Suspense } from 'react';
import { AppBar } from './app-bar';
import { RoadmapChatbot } from './roadmap-chatbot';
import { SessionSync } from './session-sync';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <AppBar />
      </Suspense>
      <SessionSync />
      <main className="app-main min-h-screen pt-[64px]">
        <div className="app-main-inner mx-auto max-w-[1680px] px-4 py-6 md:px-7 md:py-8">{children}</div>
      </main>
      <RoadmapChatbot />
    </>
  );
}
