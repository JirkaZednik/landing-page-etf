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
