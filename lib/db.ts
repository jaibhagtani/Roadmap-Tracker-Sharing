import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function runtimeDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  // Vercel/serverless functions can create several warm Prisma engines.
  // Prisma v6 defaults to a CPU-based pool, which can exhaust small Postgres plans.
  // Start at one connection per function unless the deployment explicitly overrides it.
  try {
    const url = new URL(raw);
    if (!/^postgres(?:ql)?:$/i.test(url.protocol)) return raw;
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set(
        'connection_limit',
        process.env.PRISMA_CONNECTION_LIMIT || '1',
      );
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const datasourceUrl = runtimeDatabaseUrl();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

// Reuse the same PrismaClient across warm serverless invocations.
globalForPrisma.prisma = db;

export async function withRls<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (!userId) {
    throw new Error('Missing authenticated user');
  }

  return db.$transaction(async (tx : any) => {
    await tx.$executeRaw`
      SELECT set_config('app.user_id', ${userId}, true)
    `;

    return fn(tx);
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof Response) return error;

  const message =
    error instanceof Error
      ? error.message
      : 'Unexpected server error';

  const status =
    message === 'NOT_FOUND'
      ? 404
      : message === 'FORBIDDEN' ||
          message === 'LEADER_ONLY'
        ? 403
        : message === 'CONFLICT' ||
            message === 'MERGE_CONFLICT' ||
            message === 'GROUP_FULL' ||
            message === 'MAX_BELOW_CURRENT' ||
            message === 'GROUP_EXISTS' ||
            message === 'ALREADY_MEMBER' ||
            message === 'GROUP_NOT_OPEN'
          ? 409
          : message === 'Cannot send to yourself' ||
              message === 'RECEIVER_NOT_FOUND' ||
              message === 'ALREADY_OWNER' ||
              message === 'OWNER_CANNOT_LEAVE'
            ? 400
            : message === 'FRIENDS_REQUIRES_ROADMAP' ||
                message === 'FRIENDS_REQUIRES_SHARED_ROADMAP' ||
                message === 'ROADMAP_REQUIRED' ||
                message === 'TOPIC_REQUIRED' ||
                message === 'TEMPLATE_REQUIRED' ||
                message === 'SELF_PARENT' ||
                message === 'CYCLE' ||
                message.startsWith('SCOPED_') ||
                message === 'PARENT_NOT_IN_BRANCH' ||
                message === 'BRANCH_CLOSED' ||
                message === 'UNSUPPORTED_OPERATION'
              ? 400
              : 400;

  return new Response(message, { status });
}