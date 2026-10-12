// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_VERSION, getConsent, setConsent, onConsentChange, openConsentSettings } from '../../src/lib/consent';

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('consent', () => {
  it('returns null when nothing is stored', () => {
    expect(getConsent()).toBeNull();
  });
  it('stores state under ix_consent with version and ISO time', () => {
    const s = setConsent({ analytics: true, meta: false, ga4: false });
    expect(s).toEqual({ analytics: true, meta: false, ga4: false, version: '2026-10-11', decidedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) });
    expect(JSON.parse(localStorage.getItem('ix_consent')!)).toEqual(s);
    expect(getConsent()).toEqual(s);
    expect(CONSENT_VERSION).toBe('2026-10-11');
  });
  it('returns null for corrupted JSON', () => {
    localStorage.setItem('ix_consent', '{oops');
    expect(getConsent()).toBeNull();
  });
  it('returns null for a different version (re-ask after text change)', () => {
    localStorage.setItem('ix_consent', JSON.stringify({ analytics: true, meta: true, ga4: true, version: '2025-01-01', decidedAt: '2025-01-01T00:00:00.000Z' }));
    expect(getConsent()).toBeNull();
  });
  it('survives blocked storage: get → null, set → returns state without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(getConsent()).toBeNull();
    expect(setConsent({ analytics: false, meta: false, ga4: false }).analytics).toBe(false);
  });
  it('notifies subscribers and supports unsubscribe', () => {
    const cb = vi.fn();
    const off = onConsentChange(cb);
    setConsent({ analytics: false, meta: true, ga4: false });
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ analytics: false, meta: true, ga4: false }));
    off();
    setConsent({ analytics: true, meta: true, ga4: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it('openConsentSettings dispatches ix:consent-open on window', () => {
    const cb = vi.fn();
    window.addEventListener('ix:consent-open', cb);
    openConsentSettings();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
