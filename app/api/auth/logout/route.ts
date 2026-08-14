import { NextResponse } from 'next/server'; import { destroyCurrentSession } from '@/lib/server-auth'; export async function POST(){await destroyCurrentSession();return NextResponse.json({ok:true})}
