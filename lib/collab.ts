type MessageHandler = (msg: any) => void;

const globalKey = '__roadmap_collab_hub_v1__';

function getHub() {
  const g = globalThis as any;
  if (!g[globalKey]) g[globalKey] = { handlers: new Map<string, Set<MessageHandler>>(), subscribed: new Set<string>(), redisSub: null, redisPub: null };
  return g[globalKey] as { handlers: Map<string, Set<MessageHandler>>; subscribed: Set<string>; redisSub: any; redisPub: any };
}

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS || undefined;
let RedisClient: any = null;
if (REDIS_URL) {
  try {
    // dynamic require to avoid hard compile dependency when not needed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    RedisClient = require('ioredis');
  } catch (e) {
    RedisClient = null;
  }
}

function ensureRedisClients() {
  const hub = getHub();
  if (!RedisClient || hub.redisSub) return;
  try {
    hub.redisSub = new RedisClient(REDIS_URL);
    hub.redisPub = new RedisClient(REDIS_URL);
    hub.redisSub.on('message', (channel: string, message: string) => {
      const roadmapId = channel.replace(/^collab:/, '');
      const set = hub.handlers.get(roadmapId);
      if (!set) return;
      let obj: any = null;
      try { obj = JSON.parse(message); } catch { obj = message; }
      for (const h of Array.from(set)) {
        try { h(obj); } catch {}
      }
    });
  } catch (e) {
    // fail silently — fall back to in-memory
    hub.redisSub = null;
    hub.redisPub = null;
  }
}

export function subscribe(roadmapId: string, handler: MessageHandler) {
  const hub = getHub();
  if (!hub.handlers.has(roadmapId)) hub.handlers.set(roadmapId, new Set());
  hub.handlers.get(roadmapId)!.add(handler);

  // if redis is configured, ensure clients and subscribe to channel
  if (RedisClient) {
    ensureRedisClients();
    const channel = `collab:${roadmapId}`;
    if (!hub.subscribed.has(channel) && hub.redisSub) {
      try {
        hub.redisSub.subscribe(channel);
        hub.subscribed.add(channel);
      } catch {}
    }
  }

  return () => {
    const set = hub.handlers.get(roadmapId);
    if (set) set.delete(handler);
    // if no handlers remain, unsubscribe redis
    const remaining = hub.handlers.get(roadmapId);
    if ((!remaining || remaining.size === 0) && RedisClient && hub.redisSub) {
      const channel = `collab:${roadmapId}`;
      try { hub.redisSub.unsubscribe(channel); hub.subscribed.delete(channel); } catch {}
    }
  };
}

export function publish(roadmapId: string, msg: any) {
  const hub = getHub();
  // deliver to in-memory handlers in same process
  const set = hub.handlers.get(roadmapId);
  if (set) {
    for (const h of Array.from(set)) {
      try { h(msg); } catch {}
    }
  }

  // publish via redis to other processes
  if (RedisClient) {
    ensureRedisClients();
    const channel = `collab:${roadmapId}`;
    try { hub.redisPub.publish(channel, JSON.stringify(msg)); } catch {}
  }
}
