import {NextResponse} from 'next/server';
import {withRls} from '@/lib/db';
import {requireUser} from '@/lib/server-auth';
export async function GET(){const user=await requireUser();const data=await withRls(user.id,async tx=>({roadmaps:await tx.roadmapShare.findMany({where:{userId:user.id},include:{roadmap:true},orderBy:{createdAt:'desc'}}),topics:await tx.topicShare.findMany({where:{userId:user.id},include:{topic:{include:{roadmap:true}}},orderBy:{createdAt:'desc'}}),templates:await tx.templateShare.findMany({where:{userId:user.id},include:{template:true},orderBy:{createdAt:'desc'}})}));return NextResponse.json(data)}
