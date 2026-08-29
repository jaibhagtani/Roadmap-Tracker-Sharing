import {NextResponse} from 'next/server';
import {withRls} from '@/lib/db';
import {requireUser} from '@/lib/server-auth';
import { getCached, setCached, userCacheKey } from '@/lib/redis';
export async function GET(){const user=await requireUser();const key=await userCacheKey(user.id,'shared-mine');const cached=await getCached<any>(key);if(cached)return NextResponse.json({...cached,cached:true});const data=await withRls(user.id,async tx=>({roadmaps:await tx.roadmapShare.findMany({where:{userId:user.id},include:{roadmap:true},orderBy:{createdAt:'desc'}}),topics:await tx.topicShare.findMany({where:{userId:user.id},include:{topic:{include:{roadmap:true}}},orderBy:{createdAt:'desc'}}),templates:await tx.templateShare.findMany({where:{userId:user.id},include:{template:true},orderBy:{createdAt:'desc'}})}));await setCached(key,data,20);return NextResponse.json({...data,cached:false})}
