// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

const AID = '11111111-1111-4111-8111-111111111111';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
vi.mock('../../src/lib/track', () => ({
  track: vi.fn(), firePixelLead: vi.fn(),
  getAid: () => '11111111-1111-4111-8111-111111111111',
  getUtm: () => ({ utm_source: 'meta', utm_content: 'b' }),
}));
vi.mock('../../src/lib/consent', () => ({
  getConsent: vi.fn(() => ({ analytics: true, meta: true, ga4: false, version: '2026-10-11', decidedAt: '2026-10-11T10:00:00.000Z' })),
  onConsentChange: vi.fn(() => () => {}),
}));
import { track, firePixelLead } from '../../src/lib/track';
import LeadForm from '../../src/components/LeadForm';

let io: { cb: IntersectionObserverCallback } | null;
let fetchMock: ReturnType<typeof vi.fn>;
const email = () => screen.getByLabelText('Váš e-mail') as HTMLInputElement;
const button = () => screen.getByRole('button', { name: 'Pošlete mi návod' }) as HTMLButtonElement;
const form = () => email().closest('form')!;
const submitWith = (v: string) => { fireEvent.change(email(), { target: { value: v } }); fireEvent.submit(form()); };

beforeEach(() => {
  vi.clearAllMocks();
  history.replaceState({}, '', '/');
  io = null;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { io = { cb }; }
    observe() {} disconnect() {} unobserve() {} takeRecords() { return []; }
  });
  fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
});
afterEach(cleanup);

describe('LeadForm SSR (works without JS)', () => {
  it('renders a native POST form with hidden fields and a visually hidden honeypot', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(<LeadForm placement="calc" pair="world" calc={{ deposit: 5000, horizon: 30 }} id="form" />);
    const f = host.querySelector('form')!;
    expect([f.getAttribute('method'), f.getAttribute('action'), f.id]).toEqual(['post', '/api/subscribe', 'form']);
    const val = (n: string) => (f.querySelector(`[name="${n}"]`) as HTMLInputElement | null)?.getAttribute('value');
    const em = f.querySelector('input[name="email"]')!;
    expect([em.getAttribute('type'), em.hasAttribute('required')]).toEqual(['email', true]);
    expect({
      placement: val('placement'), pair: val('pair'), calc_deposit: val('calc_deposit'), calc_horizon: val('calc_horizon'),
      consent_text_version: val('consent_text_version'), consent_marketing: val('consent_marketing'),
      aid: val('aid'), event_id: val('event_id'),
    }).toEqual({
      placement: 'calc', pair: 'world', calc_deposit: '5000', calc_horizon: '30',
      consent_text_version: '2026-10-11', consent_marketing: '0', aid: '', event_id: '',
    });
    for (const n of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) expect(val(n)).toBe('');
    const hp = f.querySelector('input[name="website"]')!;
    expect([hp.getAttribute('tabindex'), hp.getAttribute('autocomplete')]).toEqual(['-1', 'off']);
    expect(hp.closest('[style*="display"]')).toBeNull();
    expect(f.querySelector('a[href="/zasady-ochrany-osobnich-udaju"]')).not.toBeNull();
    expect(f.querySelector('button[type="submit"]')!.textContent).toBe('Pošlete mi návod');
  });
});

describe('LeadForm with JS', () => {
  it('hydrates aid, utm and consent_marketing', () => {
    render(<LeadForm placement="hero" />);
    const f = form();
    expect((f.elements.namedItem('aid') as HTMLInputElement).value).toBe(AID);
    expect((f.elements.namedItem('utm_source') as HTMLInputElement).value).toBe('meta');
    expect((f.elements.namedItem('utm_content') as HTMLInputElement).value).toBe('b');
    expect((f.elements.namedItem('consent_marketing') as HTMLInputElement).value).toBe('1');
  });

  it('double submit → exactly one request, button disabled while sending', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<LeadForm placement="hero" />);
    fireEvent.change(email(), { target: { value: 'jan.novak@seznam.cz' } });
    fireEvent.submit(form());
    fireEvent.submit(form());
    fireEvent.click(button());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(button().disabled).toBe(true));
  });

  it('sends JSON with all fields and a fresh event_id; on success tracks and fires Pixel with same id', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, redirect: `/dekujeme?aid=${AID}` }));
    render(<LeadForm placement="calc" pair="sp500" calc={{ deposit: 3000, horizon: 20 }} />);
    submitWith('jan.novak@seznam.cz');
    await vi.waitFor(() => expect(firePixelLead).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/subscribe');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      email: 'jan.novak@seznam.cz', aid: AID, placement: 'calc', pair: 'sp500', calc_deposit: '3000', calc_horizon: '20',
      utm_source: 'meta', utm_content: 'b', consent_marketing: '1', consent_text_version: '2026-10-11', website: '',
    });
    expect(body.event_id).toMatch(UUID);
    expect(firePixelLead).toHaveBeenCalledWith(body.event_id);
    expect(track).toHaveBeenCalledWith('form_submitted', { placement: 'calc' });
  });

  it('server error → message, e-mail kept, button enabled again, form_error tracked', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false, error: 'server' }, { status: 502 }));
    render(<LeadForm placement="hero" />);
    submitWith('jan.novak@seznam.cz');
    expect((await screen.findByRole('alert')).textContent).toBe('Něco se nepovedlo, zkuste to prosím znovu.');
    expect(email().value).toBe('jan.novak@seznam.cz');
    expect(button().disabled).toBe(false);
    expect(track).toHaveBeenCalledWith('form_error', { placement: 'hero', error_type: 'server' });
    expect(firePixelLead).not.toHaveBeenCalled();
  });

  it('network failure → same server message, e-mail kept', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<LeadForm placement="hero" />);
    submitWith('jan.novak@seznam.cz');
    expect((await screen.findByRole('alert')).textContent).toBe('Něco se nepovedlo, zkuste to prosím znovu.');
    expect(email().value).toBe('jan.novak@seznam.cz');
  });

  it('invalid e-mail → no request, message bound to the field', () => {
    render(<LeadForm placement="hero" />);
    submitWith('jan@seznam');
    expect(fetchMock).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Zkontrolujte prosím e-mail.');
    expect(email().getAttribute('aria-invalid')).toBe('true');
    expect(email().getAttribute('aria-describedby')).toBe(alert.id);
    expect(track).toHaveBeenCalledWith('form_error', { placement: 'hero', error_type: 'invalid_email' });
  });

  it('shows ?error= from a no-JS redirect only in the form with id="form"', () => {
    history.replaceState({}, '', '/?error=invalid_email');
    render(<><LeadForm placement="hero" id="form" /><LeadForm placement="calc" /></>);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).toBe('Zkontrolujte prosím e-mail.');
  });

  it('form_viewed once when 50 % visible; form_started on first focus only', () => {
    render(<LeadForm placement="preview" />);
    act(() => io!.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    act(() => io!.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    fireEvent.focus(email()); fireEvent.focus(email());
    expect(vi.mocked(track).mock.calls.filter(([e]) => e === 'form_viewed')).toEqual([['form_viewed', { placement: 'preview' }]]);
    expect(vi.mocked(track).mock.calls.filter(([e]) => e === 'form_started')).toEqual([['form_started', { placement: 'preview' }]]);
  });
});

describe('LeadForm uncontrolled hidden fields (FundCard overrides)', () => {
  const hidden = (n: string) => form().elements.namedItem(n) as HTMLInputElement;

  it('a DOM override of pair/placement survives a re-render and is what gets submitted and tracked', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, redirect: `/dekujeme?aid=${AID}` }));
    const { rerender } = render(<LeadForm placement="hero" pair="sp500" id="form" />);
    hidden('pair').value = 'world';
    hidden('placement').value = 'card';
    fireEvent.change(email(), { target: { value: 'jan.novak@seznam.cz' } });
    rerender(<LeadForm placement="hero" pair="sp500" id="form" />);
    expect([hidden('pair').value, hidden('placement').value]).toEqual(['world', 'card']);
    fireEvent.submit(form());
    await vi.waitFor(() => expect(firePixelLead).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ pair: 'world', placement: 'card' });
    expect(track).toHaveBeenCalledWith('form_submitted', { placement: 'card' });
  });

  it('form_error is tracked with the placement from the DOM', () => {
    render(<LeadForm placement="hero" id="form" />);
    hidden('placement').value = 'card';
    submitWith('jan@seznam');
    expect(track).toHaveBeenCalledWith('form_error', { placement: 'card', error_type: 'invalid_email' });
  });

  it('form_started uses the placement from the DOM', () => {
    render(<LeadForm placement="hero" id="form" />);
    hidden('placement').value = 'card';
    fireEvent.focus(email());
    expect(track).toHaveBeenCalledWith('form_started', { placement: 'card' });
  });

  it('a prop change updates the hidden fields', () => {
    const { rerender } = render(<LeadForm placement="calc" pair="sp500" calc={{ deposit: 3000, horizon: 20 }} />);
    rerender(<LeadForm placement="calc" pair="world" calc={{ deposit: 5000, horizon: 30 }} />);
    expect([hidden('pair').value, hidden('calc_deposit').value, hidden('calc_horizon').value]).toEqual(['world', '5000', '30']);
  });

  it('a prop change wins over an earlier DOM override', () => {
    const { rerender } = render(<LeadForm placement="calc" pair="sp500" />);
    hidden('pair').value = 'world';
    rerender(<LeadForm placement="calc" pair="us-total" />);
    expect(hidden('pair').value).toBe('us-total');
  });
});
