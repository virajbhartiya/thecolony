import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '@thecolony/config';

interface Bucket {
  tokens: number;
  updated_at: number;
}

interface ConsumeResult {
  ok: boolean;
  remaining: number;
  retry_after_seconds: number;
}

export function registerReadRateLimit(app: FastifyInstance): void {
  const e = env();
  const limitPerMinute = e.API_READ_RATE_LIMIT_PER_MINUTE;
  const burst = e.API_READ_RATE_LIMIT_BURST;
  const limiter = createTokenBucket({ burst, refillPerMinute: limitPerMinute });

  app.addHook('onRequest', async (req, reply) => {
    if (!isPublicRead(req)) return;

    const key = clientKey(req);
    const result = limiter.consume(key);
    setRateHeaders(reply, limitPerMinute, result.remaining, result.retry_after_seconds);
    if (result.ok) return;

    return reply.code(429).send({
      error: 'rate_limited',
      retry_after_seconds: result.retry_after_seconds,
    });
  });
}

export function createTokenBucket({
  burst,
  refillPerMinute,
  now = () => Date.now(),
}: {
  burst: number;
  refillPerMinute: number;
  now?: () => number;
}) {
  const buckets = new Map<string, Bucket>();
  const refillPerMs = refillPerMinute / 60_000;

  const consume = (key: string): ConsumeResult => {
    const t = now();
    const bucket = buckets.get(key) ?? { tokens: burst, updated_at: t };
    const elapsed = Math.max(0, t - bucket.updated_at);
    bucket.tokens = Math.min(burst, bucket.tokens + elapsed * refillPerMs);
    bucket.updated_at = t;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      buckets.set(key, bucket);
      return { ok: true, remaining: Math.floor(bucket.tokens), retry_after_seconds: 0 };
    }

    buckets.set(key, bucket);
    return {
      ok: false,
      remaining: 0,
      retry_after_seconds: Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerMs / 1000)),
    };
  };

  const prune = () => {
    const cutoff = now() - 10 * 60_000;
    for (const [key, bucket] of buckets) {
      if (bucket.updated_at < cutoff) buckets.delete(key);
    }
  };
  const timer = setInterval(prune, 5 * 60_000);
  timer.unref?.();

  return { consume };
}

function isPublicRead(req: FastifyRequest): boolean {
  if (req.method === 'OPTIONS') return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (!req.url.startsWith('/v1/')) return false;
  if (req.url.startsWith('/v1/health')) return false;
  return true;
}

function clientKey(req: FastifyRequest): string {
  return req.ip || 'unknown';
}

function setRateHeaders(
  reply: FastifyReply,
  limit: number,
  remaining: number,
  retryAfter: number,
): void {
  reply.header('X-RateLimit-Limit', String(limit));
  reply.header('X-RateLimit-Remaining', String(remaining));
  if (retryAfter > 0) reply.header('Retry-After', String(retryAfter));
}
