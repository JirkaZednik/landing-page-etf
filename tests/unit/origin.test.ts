// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isSameOrigin } from '../../src/server/origin';

const SITE = 'https://etf-dvojce.vercel.app';
const req = (headers: Record<string, string>) => new Request(SITE + '/api/x', { method: 'POST', headers });

beforeEach(() => { vi.unstubAllEnvs(); vi.stubEnv('SITE_URL', SITE); });

describe('isSameOrigin', () => {
  it('matching Origin → true', () => expect(isSameOrigin(req({ origin: SITE }))).toBe(true));
  it('foreign Origin → false', () => expect(isSameOrigin(req({ origin: 'https://evil.example' }))).toBe(false));
  it('foreign Origin wins over matching Referer', () =>
    expect(isSameOrigin(req({ origin: 'https://evil.example', referer: SITE + '/' }))).toBe(false));
  it('no Origin, matching Referer → true', () => expect(isSameOrigin(req({ referer: SITE + '/page?x=1' }))).toBe(true));
  it('no Origin, foreign Referer → false', () => expect(isSameOrigin(req({ referer: 'https://evil.example/' }))).toBe(false));
  it('malformed Referer → false', () => expect(isSameOrigin(req({ referer: 'not a url' }))).toBe(false));
  it('neither header → false', () => expect(isSameOrigin(req({}))).toBe(false));
  it('SITE_URL missing → false', () => {
    vi.stubEnv('SITE_URL', '');
    expect(isSameOrigin(req({ origin: SITE }))).toBe(false);
  });
});
