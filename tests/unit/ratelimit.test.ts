// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { limit, ctor } = vi.hoisted(() => ({ limit: vi.fn(), ctor: vi.fn() }));
vi.mock('@upstash/ratelimit', () => {
  class Ratelimit { constructor(o: unknown) { ctor(o); } limit = limit; static slidingWindow = vi.fn(() => 'sw'); }
  return { Ratelimit };
});
vi.mock('@upstash/redis', () => ({ Redis: class { constructor(public o: unknown) {} } }));

const load = async () => { vi.resetModules(); return (await import('../../src/server/ratelimit')).checkRateLimit; };

beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe('checkRateLimit', () => {
  it('without Upstash env → true and a warning, no Redis', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await (await load())('subscribe:1.2.3.4')).toBe(true);
    expect(warn).toHaveBeenCalled();
    expect(ctor).not.toHaveBeenCalled();
  });
  describe('with env', () => {
    beforeEach(() => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://eu1-test.upstash.io');
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok');
    });
    it('uses slidingWindow(5, "10 m") and passes the key', async () => {
      limit.mockResolvedValue({ success: true });
      const check = await load();
      expect(await check('subscribe:1.2.3.4')).toBe(true);
      const { Ratelimit } = await import('@upstash/ratelimit');
      expect(Ratelimit.slidingWindow).toHaveBeenCalledWith(5, '10 m');
      expect(limit).toHaveBeenCalledWith('subscribe:1.2.3.4');
    });
    it('custom opts → slidingWindow(20, "10 m"); limiter cached per (limit, window)', async () => {
      limit.mockResolvedValue({ success: true });
      const check = await load();
      const { Ratelimit } = await import('@upstash/ratelimit');
      await check('profile:1.2.3.4', { limit: 20, window: '10 m' });
      await check('profile:1.2.3.5', { limit: 20, window: '10 m' });
      await check('subscribe:1.2.3.4');
      await check('subscribe:1.2.3.5');
      expect(Ratelimit.slidingWindow).toHaveBeenCalledWith(20, '10 m');
      expect(Ratelimit.slidingWindow).toHaveBeenCalledWith(5, '10 m');
      expect(ctor).toHaveBeenCalledTimes(2);
    });
    it('over the limit → false', async () => {
      limit.mockResolvedValue({ success: false });
      expect(await (await load())('subscribe:1.2.3.4')).toBe(false);
    });
    it('Redis error → fail open (true) and console.error', async () => {
      limit.mockRejectedValue(new Error('timeout'));
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(await (await load())('subscribe:1.2.3.4')).toBe(true);
      expect(err).toHaveBeenCalled();
    });
  });
});
