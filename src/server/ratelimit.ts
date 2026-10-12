import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from './env';

let rl: Ratelimit | null = null;

export async function checkRateLimit(key: string): Promise<boolean> {
  const url = env('UPSTASH_REDIS_REST_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) {
    console.warn('[ratelimit] Upstash env missing – rate limiting disabled');
    return true;
  }
  try {
    rl ??= new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(5, '10 m'), prefix: 'ix' });
    return (await rl.limit(key)).success;
  } catch (e) {
    // Fail open: a Redis outage must not block leads from paid ads.
    console.error('[ratelimit]', e instanceof Error ? e.message : 'error');
    return true;
  }
}
