import { AppShell } from '@/components/app-shell';
import { RoadmapEditor } from '@/components/roadmap-editor';
import { OnePageWorkspace } from '@/components/one-page-workspace';
import { Sparkles } from 'lucide-react';

type Props={searchParams?:Promise<{view?:string}>};

export default async function Roadmap({searchParams}:Props){
  const params=searchParams?await searchParams:{};
  const onePage=params.view==='one-page';
  return <AppShell>
    {!onePage&&<header className="mb-5 flex flex-col gap-2"><div className="inline-flex w-fit items-center gap-2 rounded-full border border-[hsl(var(--line))] bg-[hsl(var(--card))] px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm"><Sparkles size={13}/> Visual roadmap studio</div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">Build your roadmap visually</h1><p className="max-w-3xl text-sm leading-6 text-slate-500">Use the editor to create a real node-and-line roadmap, attach resources, control visibility, and publish or collaborate without leaving the canvas.</p></header>}
    {onePage?<OnePageWorkspace/>:<RoadmapEditor/>}
  </AppShell>;
}
