import type { EventName } from './types';
import { isUuid } from './validate';
import { getConsent, onConsentChange, type ConsentState } from './consent';

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

type Props = Record<string, string | number | boolean>;
type Ph = typeof import('posthog-js').default;

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

let aid: string | null = null;
let ph: Ph | null = null;
let queue: [EventName, Props][] = [];
let started = false;
let disabled = false; // no PostHog key: track() only emits the DOM event
const loaded = { meta: false, ga4: false };
let lastConsent: ConsentState | null = null;
let phCookieless = false; // mode the live PostHog instance was initialised in

function expire(name: string): void {
  const base = `${encodeURIComponent(name)}=; Max-Age=0; path=/`;
  document.cookie = base;
  const parts = location.hostname.split('.');
  for (let i = 0; i <= parts.length - 2; i++) {
    const domain = parts.slice(i).join('.');
    document.cookie = `${base}; domain=${domain}`;
    document.cookie = `${base}; domain=.${domain}`;
  }
}

function cookieNames(): string[] {
  return document.cookie.split(';').map((c) => {
    const raw = c.split('=')[0].trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw; // malformed third-party cookie name: keep it as is, never throw
    }
  }).filter(Boolean);
}

// `aid` links a person's Brevo record to analytics events: it must never reach PostHog inside a URL
// ($current_url, $referrer, $initial_*, $session_entry_*). With consent it is sent via identify() only.
function stripAid(value: string): string {
  if (!/[?&]aid=/.test(value)) return value;
  return value
    .replace(/([?&])aid=[^&#]*(&?)/g, (_m, sep: string, amp: string) => (amp ? sep : sep === '?' ? '?' : ''))
    .replace(/\?(#|$)/, '$1');
}

function scrub(v: unknown): unknown {
  if (typeof v === 'string') return stripAid(v);
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    // keys too: posthog-js keys `$heatmap_data` by location.href, which carries ?aid=
    for (const [k, x] of Object.entries(v)) {
      const key = stripAid(k);
      const val = scrub(x);
      const prev = out[key];
      // keys that collide after stripping: arrays are merged, anything else keeps the last value
      out[key] = Array.isArray(prev) && Array.isArray(val) ? [...prev, ...val] : val;
    }
    return out;
  }
  return v;
}

type PhEvent = { properties: Record<string, unknown>; $set?: unknown; $set_once?: unknown };
export function scrubAid<T extends PhEvent>(e: T | null): T | null {
  if (!e) return e;
  e.properties = scrub(e.properties) as Record<string, unknown>;
  if (e.$set) e.$set = scrub(e.$set);
  if (e.$set_once) e.$set_once = scrub(e.$set_once);
  return e;
}

// Removes what a revoked purpose left in the browser (storage keys and cookies on host and parent domains).
function purge(purpose: 'analytics' | 'meta' | 'ga4'): void {
  const match =
    purpose === 'analytics' ? (n: string) => n.startsWith('ph_') || n.startsWith('__ph_')
    : purpose === 'meta' ? (n: string) => n === '_fbp'
    : (n: string) => n === '_ga' || n.startsWith('_ga_');
  for (const n of cookieNames()) if (match(n)) expire(n);
  if (purpose !== 'analytics') return;
  for (const store of [localStorage, sessionStorage]) {
    try {
      for (const k of Object.keys(store)) if (k.startsWith('ph_') || k.startsWith('__ph_')) store.removeItem(k);
    } catch {
      // blocked storage
    }
  }
}

export function getAid(): string {
  if (aid) return aid;
  const fromUrl = new URLSearchParams(location.search).get('aid');
  aid = fromUrl && isUuid(fromUrl) ? fromUrl : crypto.randomUUID();
  return aid;
}

export function getUtm(): Record<string, string> {
  const q = new URLSearchParams(location.search);
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = q.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function addScript(src: string): void {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function apply(c: ConsentState | null): void {
  const metaId = import.meta.env.PUBLIC_META_PIXEL_ID as string | undefined;
  const ga4Id = import.meta.env.PUBLIC_GA4_ID as string | undefined;

  if (c?.meta && !loaded.meta && metaId) {
    loaded.meta = true;
    if (!window.fbq) {
      const n = function (...args: unknown[]) {
        // standard Meta snippet: queue until fbevents.js replaces the stub
        (n as any).callMethod ? (n as any).callMethod(...args) : (n as any).queue.push(args);
      } as NonNullable<Window['fbq']>;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      window.fbq = n;
      window._fbq = n;
    }
    addScript('https://connect.facebook.net/en_US/fbevents.js');
    window.fbq!('init', metaId);
    window.fbq!('track', 'PageView');
  }

  if (c?.ga4 && !loaded.ga4 && ga4Id) {
    loaded.ga4 = true;
    addScript(`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`);
    window.gtag?.('consent', 'update', { analytics_storage: 'granted' });
    window.gtag?.('js', new Date());
    window.gtag?.('config', ga4Id);
  }

  if (c?.analytics && !lastConsent?.analytics && ph) {
    if (phCookieless) {
      // switch the live instance to persistent storage in place (no reload: a reload would re-send
      // page_view and Meta PageView and wipe a half-typed e-mail). 'on_reject' + opt_in is the
      // posthog-js path that leaves cookieless mode at runtime.
      ph.set_config({ cookieless_mode: 'on_reject', persistence: 'localStorage+cookie' });
      ph.opt_in_capturing({ captureEventName: null });
      phCookieless = false;
    }
    ph.identify(getAid());
  }

  // Loaded third-party scripts cannot be switched off reliably: reload without them (revoke only).
  const revoked =
    (lastConsent?.analytics && !c?.analytics) ||
    (lastConsent?.meta && !c?.meta) ||
    (lastConsent?.ga4 && !c?.ga4);
  if (revoked) {
    if (lastConsent?.analytics && !c?.analytics) purge('analytics');
    if (lastConsent?.meta && !c?.meta) purge('meta');
    if (lastConsent?.ga4 && !c?.ga4) purge('ga4');
  }
  lastConsent = c;
  if (revoked) location.reload();
}

function send(e: EventName, props: Props): void {
  try {
    ph?.capture(e, props, e === 'form_submitted' ? { send_instantly: true, transport: 'sendBeacon' } : undefined);
  } catch {
    // analytics must never break the page
  }
}

export function track(e: EventName, props: Props = {}): void {
  try {
    // observable hook for E2E tests (no network dependency)
    window.dispatchEvent(new CustomEvent('ix:track', { detail: { name: e, props } }));
  } catch {
    // ignore
  }
  if (disabled) return;
  if (ph) send(e, props);
  else queue.push([e, props]);
}

export function firePixelLead(eventId: string): void {
  if (getConsent()?.meta === true && typeof window.fbq === 'function') {
    window.fbq('track', 'Lead', {}, { eventID: eventId });
  }
}

export function initAnalytics(): void {
  if (started) return;
  started = true;

  // GA4 Consent Mode v2: everything denied until the visitor says otherwise
  window.dataLayer ??= [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    (window.dataLayer as unknown[]).push(arguments);
  };
  window.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
  });

  const consent = getConsent();
  apply(consent);

  const key = import.meta.env.PUBLIC_POSTHOG_KEY as string | undefined;
  onConsentChange(apply);
  if (!key) {
    disabled = true;
    track('page_view', pageViewProps()); // still emits ix:track, then no-op
    return;
  }

  // page_view is sent exactly once per page, from here
  track('page_view', pageViewProps());

  void import('posthog-js').then(({ default: posthog }) => {
    const cfg: Record<string, unknown> = {
      api_host: (import.meta.env.PUBLIC_POSTHOG_HOST as string | undefined) || 'https://eu.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
      autocapture: false,
      disable_session_recording: true,
      capture_heatmaps: false, // $$heatmap events are keyed by location.href (aid); not in the measurement plan
      before_send: scrubAid,
    };
    // read consent now: it may have been granted while posthog-js was loading
    phCookieless = !getConsent()?.analytics;
    if (!phCookieless) cfg.persistence = 'localStorage+cookie';
    else cfg.cookieless_mode = 'always';
    posthog.init(key, cfg);
    ph = posthog;
    if (lastConsent?.analytics) posthog.identify(getAid());
    const pending = queue;
    queue = [];
    for (const [name, props] of pending) send(name, props);
  }).catch(() => {
    disabled = true;
    queue = [];
  });
}

function pageViewProps(): Props {
  const props: Props = { path: location.pathname, ...getUtm() };
  const variant = document.documentElement.dataset.variant;
  if (variant) props.hero_variant = variant;
  return props;
}
