import { expect, vi } from 'vitest';

// posthog-js is an externalised dependency: vi.resetModules() does not give a fresh singleton,
// so each test file that uses the real library starts it exactly once (one scenario per file).
export const AID = '22222222-2222-4222-8222-222222222222';
export type Captured = { event: string; properties: Record<string, unknown>; $set?: unknown; $set_once?: unknown };

export async function startRealPosthog(url: string, referrer = '') {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  (navigator as unknown as { sendBeacon: () => boolean }).sendBeacon = vi.fn(() => true);
  vi.spyOn(document, 'referrer', 'get').mockReturnValue(referrer);
  vi.stubEnv('PUBLIC_POSTHOG_KEY', 'phc_test');
  vi.stubEnv('PUBLIC_POSTHOG_HOST', 'https://eu.i.posthog.com');
  vi.stubEnv('PUBLIC_META_PIXEL_ID', '');
  vi.stubEnv('PUBLIC_GA4_ID', '');
  history.replaceState({}, '', url);
  const t = await import('../../../src/lib/track');
  const { default: posthog } = await import('posthog-js');
  const { setConsent } = await import('../../../src/lib/consent');
  const seen: Captured[] = [];
  // fires with the final event, i.e. after before_send
  (posthog as unknown as { on: (e: string, cb: (x: Captured) => void) => void }).on('eventCaptured', (e) => seen.push(e));
  t.initAnalytics();
  await vi.waitFor(() => expect(posthog.__loaded).toBe(true));
  return { t, posthog, seen, setConsent };
}
