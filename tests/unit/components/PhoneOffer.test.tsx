// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../src/lib/track', () => ({ track: vi.fn(), getAid: () => 'test-aid' }));
import { track } from '../../../src/lib/track';
import { PHONE_COPY } from '../../../src/lib/copy';
import PhoneOffer from '../../../src/components/PhoneOffer';

const fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetch.mockReset();
  // a fresh Response per call (a body can be read only once)
  fetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
  vi.stubGlobal('fetch', fetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function fill(phone: string, a: boolean, b: boolean) {
  await userEvent.type(screen.getByLabelText('Telefon'), phone);
  if (a) await userEvent.click(screen.getByLabelText(PHONE_COPY.consentCall));
  if (b) await userEvent.click(screen.getByLabelText(PHONE_COPY.consentPartners));
  await userEvent.click(screen.getByRole('button', { name: 'Zavolejte mi' }));
}

describe('PhoneOffer', () => {
  it.each([
    ['777 123 456', '+420777123456'],
    ['+420777123456', '+420777123456'],
    ['00420 777 123 456', '+420777123456'],
  ])('CZ format %j is normalized', async (raw, normalized) => {
    render(<PhoneOffer page="dekujeme" />);
    await fill(raw, true, false);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/profile');
    expect(JSON.parse(init.body)).toEqual({ aid: 'test-aid', phone: normalized, consent_call: true, consent_partners: false, consent_text_version: '2026-10-11' });
    expect(await screen.findByText('Děkujeme, číslo máme. Ozveme se vám.')).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('phone_submitted', { page: 'dekujeme', consent_partners: false });
  });

  it.each(['+421 905 123 456', '12345'])('rejects %j without request', async (raw) => {
    render(<PhoneOffer page="dekujeme" />);
    await fill(raw, true, false);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Zadejte české číslo, např. 777 123 456 nebo +420 777 123 456.')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not send without consent (a)', async () => {
    render(<PhoneOffer page="dekujeme" />);
    await fill('777 123 456', false, true);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Bez souhlasu s telefonickým kontaktem vám zavolat nemůžeme.')).toBeInTheDocument();
  });

  it('sends consent_partners true when (b) checked', async () => {
    render(<PhoneOffer page="dekujeme" />);
    await fill('777 123 456', true, true);
    expect(JSON.parse(fetch.mock.calls[0][1].body).consent_partners).toBe(true);
    expect(track).toHaveBeenCalledWith('phone_submitted', { page: 'dekujeme', consent_partners: true });
  });

  it('both consents start unchecked; no second-visit note (only one thank-you page)', () => {
    render(<PhoneOffer page="dekujeme" />);
    screen.getAllByRole('checkbox').forEach((c) => expect(c).not.toBeChecked());
    expect(screen.queryByText('Pokud jste telefon už zadali, nemusíte nic dělat.')).not.toBeInTheDocument();
  });

  it.each([
    ['phone_taken', 'Toto číslo už u nás má jiný kontakt. Napište nám na etf-dvojce@seznam.cz.'],
    ['rate_limited', 'Něco se nepovedlo, zkuste to znovu.'],
    ['server', 'Něco se nepovedlo, zkuste to znovu.'],
  ])('API error %s shows message and keeps value', async (error, msg) => {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error }), { status: 400 }));
    render(<PhoneOffer page="dekujeme" />);
    await fill('777 123 456', true, false);
    expect(await screen.findByText(msg)).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).toHaveValue('777 123 456');
    expect(track).not.toHaveBeenCalledWith('phone_submitted', expect.anything());
  });

  it('button disabled while sending → single request on double click', async () => {
    fetch.mockImplementationOnce(() => new Promise((r) => setTimeout(() => r(new Response('{"ok":true}')), 50)));
    render(<PhoneOffer page="dekujeme" />);
    await userEvent.type(screen.getByLabelText('Telefon'), '777123456');
    await userEvent.click(screen.getByLabelText(PHONE_COPY.consentCall));
    await userEvent.dblClick(screen.getByRole('button', { name: 'Zavolejte mi' }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
