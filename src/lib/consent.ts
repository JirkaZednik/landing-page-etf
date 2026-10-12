export const CONSENT_VERSION = '2026-10-11';

export type ConsentState = {
  analytics: boolean;
  meta: boolean;
  ga4: boolean;
  version: string;
  decidedAt: string;
};

const KEY = 'ix_consent';

export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (
      !v || typeof v !== 'object' ||
      typeof v.analytics !== 'boolean' || typeof v.meta !== 'boolean' || typeof v.ga4 !== 'boolean' ||
      v.version !== CONSENT_VERSION
    ) return null;
    return v as ConsentState;
  } catch {
    return null;
  }
}

export function setConsent(c: Pick<ConsentState, 'analytics' | 'meta' | 'ga4'>): ConsentState {
  const state: ConsentState = {
    analytics: c.analytics,
    meta: c.meta,
    ga4: c.ga4,
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // blocked storage: the choice applies to this page view only
  }
  window.dispatchEvent(new CustomEvent('ix:consent-change', { detail: state }));
  return state;
}

export function onConsentChange(cb: (c: ConsentState) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ConsentState>).detail);
  window.addEventListener('ix:consent-change', handler);
  return () => window.removeEventListener('ix:consent-change', handler);
}

export function openConsentSettings(): void {
  window.dispatchEvent(new Event('ix:consent-open'));
}
