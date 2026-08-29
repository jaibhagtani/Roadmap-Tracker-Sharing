'use client';
import { useState } from 'react';
import { useGetJsonQuery, useRequestMutation } from '@/lib/redux/api';
import { AppShell } from '@/components/app-shell';
import { Card, Button } from '@/components/ui';
type Template={id:string;name:string;description:string;tree:any[]};

export default function Templates(){
 const{data,isLoading}=useGetJsonQuery({url:'/api/templates',tag:'templates'});
 const templates=((data as any)?.templates||[]) as Template[];
 const[busy,setBusy]=useState('');const[receiver,setReceiver]=useState('');
 const[request]=useRequestMutation();
 async function shareTemplate(id:string,name:string){if(!receiver.trim())return alert('Enter the receiver User ID.');try{await request({url:'/api/share-requests',method:'POST',body:{scopeType:'template',templateId:id,receiverId:receiver.trim(),message:`You have been invited to use the ${name} template.`},invalidate:['share-requests-sent','notifications']}).unwrap();setReceiver('');alert('Template share notification sent.')}catch(e){alert(e instanceof Error?e.message:'Unable to share template.')}}
 async function useTemplate(id:string,name:string){setBusy(id);try{const j:any=await request({url:'/api/templates',method:'POST',body:{templateId:id},invalidate:['roadmaps']}).unwrap();alert(`${name} roadmap created.`);location.href=`/roadmap?roadmapId=${j.roadmap.id}`}catch(e){alert(e instanceof Error?e.message:'Unable to create roadmap.')}finally{setBusy('')}}
 return <AppShell><header><h1 className="text-3xl font-bold">Templates</h1><p className="mt-1 text-slate-500">Templates create real database-backed roadmaps that you can edit immediately.</p></header><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map(t=><Card key={t.id} className="p-6"><div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Template</div><h2 className="mt-2 text-lg font-semibold">{t.name}</h2><p className="mt-2 text-sm text-slate-500">{t.description}</p><p className="mt-4 text-xs text-slate-500">{t.tree.length} top-level areas · unlimited editable nesting</p><Button className="mt-5 w-full" disabled={!!busy} onClick={()=>useTemplate(t.id,t.name)}>{busy===t.id?'Creating…':'Use template'}</Button><div className="mt-3 flex gap-2"><input value={receiver} onChange={e=>setReceiver(e.target.value)} placeholder="Receiver User ID" className="min-w-0 flex-1 rounded-xl border border-[hsl(var(--line))] bg-transparent px-3 py-2 text-xs"/><Button variant="outline" onClick={()=>shareTemplate(t.id,t.name)}>Share</Button></div></Card>)}</div></AppShell>}
