import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

export async function withRls<T>(userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  if (!userId) throw new Error('Missing authenticated user');
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.user_id', ${userId}, true)`;
    return fn(tx);
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  const status = message === 'NOT_FOUND' ? 404 : message === 'FORBIDDEN' ? 403 : message === 'Cannot send to yourself' ? 400 : message === 'ROADMAP_REQUIRED' || message === 'TOPIC_REQUIRED' || message === 'TEMPLATE_REQUIRED' || message === 'SELF_PARENT' || message === 'CYCLE' ? 400 : 400;
  return new Response(message, { status });
}
