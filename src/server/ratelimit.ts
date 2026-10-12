import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from './env';

type Window = Parameters<typeof Ratelimit.slidingWindow>[1];
const limiters = new Map<string, Ratelimit>();

export async function checkRateLimit(
  key: string,
  opts: { limit: number; window: Window } = { limit: 5, window: '10 m' },
): Promise<boolean> {
  const url = env('UPSTASH_REDIS_REST_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) {
    console.warn('[ratelimit] Upstash env missing – rate limiting disabled');
    return true;
  }
  try {
    const id = `${opts.limit}/${opts.window}`;
    let rl = limiters.get(id);
    if (!rl) {
      rl = new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(opts.limit, opts.window), prefix: 'ix' });
      limiters.set(id, rl);
    }
    return (await rl.limit(key)).success;
  } catch (e) {
    // Fail open: a Redis outage must not block leads from paid ads.
    console.error('[ratelimit]', e instanceof Error ? e.message : 'error');
    return true;
  }
}
