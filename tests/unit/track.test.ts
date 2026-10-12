// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted: the same mock object survives vi.resetModules() in load()
const posthog = vi.hoisted(() => ({
  init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn(), set_config: vi.fn(), opt_in_capturing: vi.fn(),
}));
vi.mock('posthog-js', () => ({ default: posthog }));

const AID = '11111111-1111-4111-8111-111111111111';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const consent = (c: { analytics: boolean; meta: boolean; ga4: boolean }) =>
  localStorage.setItem('ix_consent', JSON.stringify({ ...c, version: '2026-10-11', decidedAt: '2026-10-11T10:00:00.000Z' }));
const load = async () => { vi.resetModules(); return import('../../src/lib/track'); };
// jsdom cannot reload: location.reload() surfaces as a "not implemented: navigation" console error
const reloaded = (err: { mock: { calls: unknown[][] } }) =>
  err.mock.calls.some((c) => String(c[0]).includes('navigation'));
const ready = () => vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());

// each load() adds a window listener; drop them so earlier module instances don't react to later tests
const listeners: EventListener[] = [];
const realAdd = window.addEventListener.bind(window);
window.addEventListener = ((type: string, fn: EventListener, o?: unknown) => {
  if (type === 'ix:consent-change') listeners.push(fn);
  realAdd(type, fn, o as AddEventListenerOptions);
}) as typeof window.addEventListener;
afterEach(() => { for (const fn of listeners.splice(0)) window.removeEventListener('ix:consent-change', fn); });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.head.innerHTML = '';
  delete (window as any).fbq; delete (window as any).gtag; delete (window as any).dataLayer;
  history.replaceState({}, '', '/');
  vi.stubEnv('PUBLIC_POSTHOG_KEY', 'phc_test');
  vi.stubEnv('PUBLIC_POSTHOG_HOST', 'https://eu.i.posthog.com');
  vi.stubEnv('PUBLIC_META_PIXEL_ID', '1234567890');
  vi.stubEnv('PUBLIC_GA4_ID', 'G-TEST123');
});

describe('track without consent', () => {
  it('inits PostHog cookieless, never identifies, never sends aid', async () => {
    const t = await load();
    t.initAnalytics(); await ready();
    expect(posthog.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({
      api_host: 'https://eu.i.posthog.com', cookieless_mode: 'always', person_profiles: 'identified_only',
    }));
    expect((posthog.init.mock.calls[0][1] as Record<string, unknown>).before_send).toBe(t.scrubAid);
    // heatmaps ($$heatmap events keyed by location.href) are not in the measurement plan
    expect(posthog.init.mock.calls[0][1]).toMatchObject({ capture_heatmaps: false });
    t.track('form_viewed', { placement: 'hero' });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith('form_viewed', { placement: 'hero' }, undefined));
    expect(posthog.identify).not.toHaveBeenCalled();
    for (const call of posthog.capture.mock.calls) expect(call[1]).not.toHaveProperty('aid');
  });
  it('loads neither Meta Pixel nor GA4 and sets Consent Mode v2 default denied', async () => {
    const t = await load();
    t.initAnalytics(); await ready();
    expect(document.querySelector('script[src*="connect.facebook.net"]')).toBeNull();
    expect(document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
    expect(Array.from((window as any).dataLayer[0])).toEqual(['consent', 'default', {
      ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
    }]);
  });
  it('firePixelLead is a no-op without meta consent', async () => {
    const t = await load();
    t.initAnalytics(); await ready();
    expect(() => t.firePixelLead('evt-1')).not.toThrow();
    expect((window as any).fbq).toBeUndefined();
  });
});

describe('track with consent', () => {
  it('analytics consent → persistent mode + identify(aid from URL)', async () => {
    consent({ analytics: true, meta: false, ga4: false });
    history.replaceState({}, '', `/dekujeme?aid=${AID}`);
    const t = await load();
    t.initAnalytics(); await ready();
    const cfg = posthog.init.mock.calls[0][1] as Record<string, unknown>;
    expect(cfg.cookieless_mode).toBeUndefined();
    expect(cfg.persistence).toBe('localStorage+cookie');
    expect(cfg.before_send).toBe(t.scrubAid);
    expect(posthog.identify).toHaveBeenCalledWith(AID);
  });
  it('Meta and GA4 granted mid-session → scripts load, consent update, no reload', async () => {
    const t = await load();
    const { setConsent } = await import('../../src/lib/consent');
    t.initAnalytics(); await ready();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    setConsent({ analytics: false, meta: true, ga4: true });
    expect(document.querySelector('script[src="https://connect.facebook.net/en_US/fbevents.js"]')).not.toBeNull();
    expect(document.querySelector('script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]')).not.toBeNull();
    expect((window as any).dataLayer.map((a: IArguments) => Array.from(a)))
      .toContainEqual(['consent', 'update', { analytics_storage: 'granted' }]);
    expect(reloaded(err)).toBe(false);
  });
  it('analytics granted after a cookieless init → switches PostHog to persistent in place and identifies, no reload, no 2nd page_view', async () => {
    history.replaceState({}, '', `/?aid=${AID}`);
    const t = await load();
    const { setConsent } = await import('../../src/lib/consent');
    t.initAnalytics(); await ready();
    expect(posthog.init.mock.calls[0][1]).toMatchObject({ cookieless_mode: 'always' });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith('page_view', expect.anything(), undefined));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    setConsent({ analytics: true, meta: false, ga4: false });
    expect(reloaded(err)).toBe(false);
    expect(posthog.set_config).toHaveBeenCalledWith(expect.objectContaining({ cookieless_mode: 'on_reject', persistence: 'localStorage+cookie' }));
    expect(posthog.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: null });
    expect(posthog.identify).toHaveBeenCalledWith(AID);
    // order: switch mode, opt in, then identify
    expect(posthog.set_config.mock.invocationCallOrder[0]).toBeLessThan(posthog.opt_in_capturing.mock.invocationCallOrder[0]);
    expect(posthog.opt_in_capturing.mock.invocationCallOrder[0]).toBeLessThan(posthog.identify.mock.invocationCallOrder[0]);
    expect(posthog.capture.mock.calls.filter((c) => c[0] === 'page_view')).toHaveLength(1);
    // a later change of another purpose does not identify again
    setConsent({ analytics: true, meta: false, ga4: true });
    expect(posthog.identify).toHaveBeenCalledTimes(1);
  });
  it('accept-all on the first visit → exactly one Meta PageView and one GA4 config, no reload', async () => {
    const t = await load();
    const { setConsent } = await import('../../src/lib/consent');
    t.initAnalytics(); await ready();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    setConsent({ analytics: true, meta: true, ga4: true });
    setConsent({ analytics: true, meta: true, ga4: true }); // banner re-saved: still nothing duplicated
    expect(reloaded(err)).toBe(false);
    const fbqCalls = ((window as any).fbq.queue as unknown[][]).filter((a) => a[0] === 'track' && a[1] === 'PageView');
    expect(fbqCalls).toHaveLength(1);
    const configs = (window as any).dataLayer.map((a: IArguments) => Array.from(a)).filter((a: unknown[]) => a[0] === 'config');
    expect(configs).toEqual([['config', 'G-TEST123']]);
    expect(posthog.capture.mock.calls.filter((c) => c[0] === 'page_view')).toHaveLength(1);
  });
  it('after that reload (consent stored) PostHog starts persistent and identifies', async () => {
    consent({ analytics: true, meta: false, ga4: false });
    const t = await load();
    t.initAnalytics(); await ready();
    expect(posthog.init.mock.calls[0][1]).toMatchObject({ persistence: 'localStorage+cookie' });
    expect(posthog.identify).toHaveBeenCalledWith(t.getAid());
  });
  it('firePixelLead sends Lead with eventID for dedup', async () => {
    consent({ analytics: false, meta: true, ga4: false });
    const t = await load();
    t.initAnalytics(); await ready();
    const fbq = vi.fn(); (window as any).fbq = fbq;
    t.firePixelLead('evt-1');
    expect(fbq).toHaveBeenCalledWith('track', 'Lead', {}, { eventID: 'evt-1' });
  });
});

describe('page_view hero_variant', () => {
  it('adds hero_variant from <html data-variant> when present', async () => {
    document.documentElement.dataset.variant = 'b';
    try {
      const t = await load();
      t.initAnalytics(); await ready();
      await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith('page_view', { path: '/', hero_variant: 'b' }, undefined));
      expect(posthog.capture.mock.calls.filter((c) => c[0] === 'page_view')).toHaveLength(1);
    } finally { delete document.documentElement.dataset.variant; }
  });
  it('skips Meta Pixel when PUBLIC_META_PIXEL_ID is empty', async () => {
    vi.stubEnv('PUBLIC_META_PIXEL_ID', '');
    consent({ analytics: false, meta: true, ga4: false });
    const t = await load();
    t.initAnalytics(); await ready();
    expect(document.querySelector('script[src*="connect.facebook.net"]')).toBeNull();
  });
});

describe('revoking consent', () => {
  const seed = () => {
    localStorage.setItem('ph_phc_test_posthog', '{}');
    localStorage.setItem('keep_me', '1');
    document.cookie = 'ph_phc_test_posthog=1; path=/';
    document.cookie = '_fbp=fb.1; path=/';
    document.cookie = '_ga=GA1; path=/';
    document.cookie = '_ga_TEST123=GS1; path=/';
    document.cookie = 'other=1; path=/';
  };
  const names = () => document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter(Boolean);
  const run = async (from: { analytics: boolean; meta: boolean; ga4: boolean }, to: typeof from) => {
    consent(from);
    seed();
    const t = await load();
    const { setConsent } = await import('../../src/lib/consent');
    t.initAnalytics(); await ready();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    setConsent(to);
    return err;
  };
  it('analytics revoked → ph_* storage and cookies removed, others kept', async () => {
    await run({ analytics: true, meta: true, ga4: true }, { analytics: false, meta: true, ga4: true });
    expect(localStorage.getItem('ph_phc_test_posthog')).toBeNull();
    expect(localStorage.getItem('keep_me')).toBe('1');
    expect(names()).not.toContain('ph_phc_test_posthog');
    expect(names()).toEqual(expect.arrayContaining(['_fbp', '_ga', '_ga_TEST123', 'other']));
  });
  it('Meta revoked → _fbp removed only', async () => {
    await run({ analytics: true, meta: true, ga4: true }, { analytics: true, meta: false, ga4: true });
    expect(names()).not.toContain('_fbp');
    expect(names()).toEqual(expect.arrayContaining(['ph_phc_test_posthog', '_ga', '_ga_TEST123']));
  });
  it('analytics revoked → also removes the __ph_opt_in_out_* flag set by the in-place opt-in', async () => {
    localStorage.setItem('__ph_opt_in_out_phc_test', '1');
    await run({ analytics: true, meta: true, ga4: true }, { analytics: false, meta: true, ga4: true });
    expect(localStorage.getItem('__ph_opt_in_out_phc_test')).toBeNull();
  });
  it('a malformed third-party cookie name does not break revoke handling (purge + reload still happen)', async () => {
    document.cookie = '%E0%A4%A=1; path=/';
    try {
      expect(document.cookie).toContain('%E0%A4%A');
      const err = await run({ analytics: true, meta: true, ga4: true }, { analytics: true, meta: false, ga4: true });
      expect(names()).not.toContain('_fbp');
      expect(reloaded(err)).toBe(true);
    } finally {
      document.cookie = '%E0%A4%A=; Max-Age=0; path=/';
    }
  });
  it('GA4 revoked → _ga and _ga_* removed only', async () => {
    await run({ analytics: true, meta: true, ga4: true }, { analytics: true, meta: true, ga4: false });
    expect(names()).not.toContain('_ga');
    expect(names()).not.toContain('_ga_TEST123');
    expect(names()).toEqual(expect.arrayContaining(['ph_phc_test_posthog', '_fbp', 'other']));
  });
});

describe('helpers', () => {
  it('getAid: from ?aid=, otherwise a stable in-memory UUID', async () => {
    let t = await load();
    const a = t.getAid();
    expect(a).toMatch(UUID);
    expect(t.getAid()).toBe(a);
    history.replaceState({}, '', `/?aid=${AID}`);
    t = await load();
    expect(t.getAid()).toBe(AID);
  });
  it('getAid ignores a malformed ?aid=', async () => {
    history.replaceState({}, '', '/?aid=<script>');
    const t = await load();
    expect(t.getAid()).toMatch(UUID);
  });
  it('scrubAid removes aid from every URL position and leaves other params and non-URL values alone', async () => {
    const t = await load();
    const ev = (p: Record<string, unknown>) => t.scrubAid({ properties: p })!.properties;
    expect(ev({
      a: `https://x.cz/dekujeme?aid=${AID}`,
      b: `https://x.cz/dekujeme?aid=${AID}&utm_source=meta`,
      c: `https://x.cz/dekujeme?utm_source=meta&aid=${AID}&utm_content=b`,
      d: `https://x.cz/dekujeme?utm_source=meta&aid=${AID}`,
      e: `https://x.cz/dekujeme?aid=${AID}#form`,
      f: 'https://x.cz/?maid=1&said=2',
      g: 42,
      h: { $initial_current_url: `https://x.cz/?aid=${AID}` },
    })).toEqual({
      a: 'https://x.cz/dekujeme',
      b: 'https://x.cz/dekujeme?utm_source=meta',
      c: 'https://x.cz/dekujeme?utm_source=meta&utm_content=b',
      d: 'https://x.cz/dekujeme?utm_source=meta',
      e: 'https://x.cz/dekujeme#form',
      f: 'https://x.cz/?maid=1&said=2',
      g: 42,
      h: { $initial_current_url: 'https://x.cz/' },
    });
    expect(t.scrubAid({ properties: {}, $set_once: { $initial_current_url: `/?aid=${AID}` } })!.$set_once)
      .toEqual({ $initial_current_url: '/' });
    expect(t.scrubAid(null)).toBeNull();
  });
  it('scrubAid strips aid from object KEYS too ($heatmap_data is keyed by location.href), values intact', async () => {
    const t = await load();
    const rows = [{ x: 1, y: 2, target_fixed: false, type: 'click' }];
    const ev = t.scrubAid({ properties: {
      $heatmap_data: { [`https://x.cz/dekujeme?aid=${AID}&utm_source=meta`]: rows, 'https://x.cz/': [{ x: 3 }] },
      nested: { deep: { [`https://x.cz/potvrzeno?aid=${AID}`]: ['v'] } },
    } })!.properties;
    expect(ev).toEqual({
      $heatmap_data: { 'https://x.cz/dekujeme?utm_source=meta': rows, 'https://x.cz/': [{ x: 3 }] },
      nested: { deep: { 'https://x.cz/potvrzeno': ['v'] } },
    });
    expect(JSON.stringify(ev)).not.toContain(AID);
  });
  it('scrubAid: keys that collide after stripping have their arrays merged, otherwise the last wins', async () => {
    const t = await load();
    const ev = t.scrubAid({ properties: { h: {
      'https://x.cz/dekujeme': [{ n: 1 }],
      [`https://x.cz/dekujeme?aid=${AID}`]: [{ n: 2 }],
      'https://x.cz/a': 'first',
      [`https://x.cz/a?aid=${AID}`]: 'last',
    } } })!.properties;
    expect(ev).toEqual({ h: { 'https://x.cz/dekujeme': [{ n: 1 }, { n: 2 }], 'https://x.cz/a': 'last' } });
  });
  it('getUtm returns only utm_* params present in the URL', async () => {
    history.replaceState({}, '', '/?utm_source=meta&utm_campaign=launch&utm_content=b&foo=1');
    const t = await load();
    expect(t.getUtm()).toEqual({ utm_source: 'meta', utm_campaign: 'launch', utm_content: 'b' });
  });
  it('form_submitted is sent instantly via sendBeacon (survives redirect)', async () => {
    const t = await load();
    t.initAnalytics(); await ready();
    t.track('form_submitted', { placement: 'hero' });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith(
      'form_submitted', { placement: 'hero' }, { send_instantly: true, transport: 'sendBeacon' }));
  });
  it('without PUBLIC_POSTHOG_KEY: no init, track does not throw', async () => {
    vi.stubEnv('PUBLIC_POSTHOG_KEY', '');
    const t = await load();
    t.initAnalytics();
    expect(() => t.track('page_view')).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    expect(posthog.init).not.toHaveBeenCalled();
  });
  it('initAnalytics twice → init once; page_view sent with UTM and path', async () => {
    history.replaceState({}, '', '/?utm_source=meta&utm_content=a');
    const t = await load();
    t.initAnalytics(); t.initAnalytics(); await ready();
    expect(posthog.init).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith(
      'page_view', { path: '/', utm_source: 'meta', utm_content: 'a' }, undefined));
  });
});
