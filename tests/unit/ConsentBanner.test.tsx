// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ConsentBanner from '../../src/components/ConsentBanner';
import { getConsent, setConsent, openConsentSettings } from '../../src/lib/consent';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('ConsentBanner', () => {
  it('shows Odmítnout and Přijmout with identical styling', () => {
    render(<ConsentBanner />);
    const reject = screen.getByRole('button', { name: 'Odmítnout' });
    const accept = screen.getByRole('button', { name: 'Přijmout' });
    expect(reject.className).toBe(accept.className);
    expect(screen.getByRole('link', { name: /cookies/i }).getAttribute('href')).toBe('/cookies');
  });
  it('Odmítnout stores all purposes false and hides the banner', () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Odmítnout' }));
    expect(getConsent()).toMatchObject({ analytics: false, meta: false, ga4: false });
    expect(screen.queryByRole('region', { name: 'Souhlas s cookies' })).toBeNull();
  });
  it('Přijmout stores all purposes true', () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Přijmout' }));
    expect(getConsent()).toMatchObject({ analytics: true, meta: true, ga4: true });
  });
  it('Nastavení offers unchecked purposes; saving only Meta stores only Meta', () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Nastavení' }));
    const boxes = [/Analytika/, /Meta/, /Google Analytics 4/].map((n) => screen.getByRole('checkbox', { name: n }) as HTMLInputElement);
    expect(boxes.map((b) => b.checked)).toEqual([false, false, false]);
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Uložit volbu' }));
    expect(getConsent()).toMatchObject({ analytics: false, meta: true, ga4: false });
  });
  it('reopened via [data-consent-open]: focus moves to the region, and returns to the opener on close', () => {
    setConsent({ analytics: false, meta: false, ga4: false });
    render(<><ConsentBanner /><button type="button" data-consent-open>Nastavení cookies</button></>);
    const opener = screen.getByRole('button', { name: 'Nastavení cookies' });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Souhlas s cookies' }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit volbu' }));
    expect(document.activeElement).toBe(opener);
  });
  it('hidden when decided; reopens with saved state via openConsentSettings and [data-consent-open]', () => {
    setConsent({ analytics: true, meta: false, ga4: false });
    render(<><ConsentBanner /><button type="button" data-consent-open>Nastavení cookies</button></>);
    expect(screen.queryByRole('region', { name: 'Souhlas s cookies' })).toBeNull();
    act(() => openConsentSettings());
    expect((screen.getByRole('checkbox', { name: /Analytika/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Uložit volbu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nastavení cookies' }));
    expect(screen.getByRole('region', { name: 'Souhlas s cookies' })).toBeTruthy();
  });
});
