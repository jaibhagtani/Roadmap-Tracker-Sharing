import { NextResponse } from 'next/server';
import { withRls, errorResponse } from '@/lib/db';
import { requireUser } from '@/lib/server-auth';
import { z } from 'zod';
const schema=z.object({action:z.enum(['accept','reject'])});
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser();const {id}=await params;const input=schema.parse(await req.json());const result=await withRls(user.id,async tx=>{const invite=await tx.shareRequest.findFirst({where:{id,receiverId:user.id,status:'pending'}});if(!invite)throw new Error('NOT_FOUND');const status=input.action==='accept'?'accepted':'rejected';if(status==='accepted'){if(invite.scopeType==='roadmap'&&invite.roadmapId)await tx.roadmapShare.upsert({where:{roadmapId_userId:{roadmapId:invite.roadmapId,userId:user.id}},create:{roadmapId:invite.roadmapId,userId:user.id},update:{}});if(invite.scopeType==='topic'&&invite.rootTopicId){
  const topics=await tx.topic.findMany({where:{roadmapId:invite.roadmapId!},select:{id:true,parentId:true}});
  const allowed=new Set<string>(); const stack=[invite.rootTopicId];
  while(stack.length){const id=stack.pop()!; if(allowed.has(id)) continue; allowed.add(id); for(const t of topics) if(t.parentId===id) stack.push(t.id)}
  if(allowed.size) await tx.topicShare.createMany({data:Array.from(allowed).map(topicId=>({topicId,userId:user.id})),skipDuplicates:true});
}if(invite.scopeType==='template'&&invite.templateId)await tx.templateShare.upsert({where:{templateId_userId:{templateId:invite.templateId,userId:user.id}},create:{templateId:invite.templateId,userId:user.id},update:{}})}await tx.notification.create({data:{userId:invite.senderId,type:`share_request_${status}`,title:`Share request ${status}`,body:status==='accepted'?'The receiver accepted your share request.':'The receiver rejected your share request.',shareRequestId:invite.id}});return tx.shareRequest.update({where:{id},data:{status}})});return NextResponse.json({shareRequest:result})}catch(e){return errorResponse(e)}}
