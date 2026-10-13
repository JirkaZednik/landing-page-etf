// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLeadContact, upsertProfile } from '../../src/server/brevo';

const AID = '11111111-1111-4111-8111-111111111111';
const res = (status: number, body?: object) => new Response(body ? JSON.stringify(body) : null, { status });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('BREVO_API_KEY', 'test-key'); vi.stubEnv('BREVO_LIST_ID', '7');
  vi.stubEnv('SITE_URL', 'https://etf-dvojce.vercel.app');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const lead = () => createLeadContact({ email: 'jan.novak@seznam.cz', aid: AID, attributes: { AID, PLACEMENT: 'hero' } });
const prof = () => upsertProfile({ aid: AID, phone: '+420777123456', consentCall: true, consentTextVersion: '2026-10-13' });

describe('createLeadContact', () => {
  it('creates the contact with one POST /v3/contacts (single opt-in), ext_id = aid', async () => {
    fetchMock.mockResolvedValue(res(201, { id: 21 }));
    await lead();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/contacts');
    expect(url).not.toContain('doubleOptinConfirmation');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'jan.novak@seznam.cz', ext_id: AID, listIds: [7], updateEnabled: true,
      attributes: { AID, PLACEMENT: 'hero' },
    });
  });
  it('profile update uses the same identifier (ext_id = aid) as the lead contact', async () => {
    fetchMock.mockResolvedValue(res(204));
    await lead(); await prof();
    const [a, b] = fetchMock.mock.calls.map(([, i]) => JSON.parse((i as RequestInit).body as string));
    expect(b.ext_id).toBe(a.ext_id);
    expect(b.updateEnabled).toBe(true);
  });
  it.each([
    [res(201, {}), { ok: true, aid: AID }],
    [res(204), { ok: true, aid: AID }],
    [res(400, { code: 'invalid_parameter', message: 'Invalid email address' }), { ok: false, error: 'brevo' }],
    [res(401, { code: 'unauthorized', message: 'Key not found' }), { ok: false, error: 'brevo' }],
    [res(500), { ok: false, error: 'brevo' }],
  ])('response → %#', async (r, expected) => {
    fetchMock.mockResolvedValue(r);
    expect(await lead()).toEqual(expected);
  });
  it('network error → brevo', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await lead()).toEqual({ ok: false, error: 'brevo' });
  });

  const conflict = () => res(400, { code: 'duplicate_parameter', message: 'Contact already exist' });
  const bodies = () => fetchMock.mock.calls.map(([, i]) => JSON.parse((i as RequestInit).body as string));
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('identifier conflict → one retry with a fresh aid as ext_id and AID; returns that aid', async () => {
    fetchMock.mockResolvedValueOnce(conflict()).mockResolvedValueOnce(res(201, { id: 22 }));
    const r = await lead();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, retry] = bodies();
    expect(retry.ext_id).toMatch(UUID);
    expect(retry.ext_id).not.toBe(AID);
    expect(retry).toEqual({
      email: 'jan.novak@seznam.cz', ext_id: retry.ext_id, listIds: [7], updateEnabled: true,
      attributes: { AID: retry.ext_id, PLACEMENT: 'hero' },
    });
    expect(r).toEqual({ ok: true, aid: retry.ext_id });
  });
  it('second conflict → final retry without ext_id keeps listIds and attributes; logs the fallback', async () => {
    fetchMock.mockResolvedValueOnce(conflict()).mockResolvedValueOnce(conflict()).mockResolvedValueOnce(res(204));
    const r = await lead();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, retry, last] = bodies();
    expect(last.AID).toBeUndefined();
    expect(last.attributes.AID).toMatch(UUID);
    expect(last.attributes.AID).not.toBe(AID);
    expect(last).toEqual({ email: 'jan.novak@seznam.cz', listIds: [7], updateEnabled: true, attributes: { AID: last.attributes.AID, PLACEMENT: 'hero' } });
    expect(r).toEqual({ ok: true, aid: last.attributes.AID });
    expect(last.attributes.AID).toBe(retry.ext_id);
    expect(console.error).toHaveBeenCalledWith('[brevo] ext_id conflict twice, contact saved without ext_id');
  });
  it('final retry failing → brevo', async () => {
    fetchMock.mockResolvedValueOnce(conflict()).mockResolvedValueOnce(conflict()).mockResolvedValueOnce(conflict());
    expect(await lead()).toEqual({ ok: false, error: 'brevo' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('non-conflict error → brevo without retry', async () => {
    fetchMock.mockResolvedValueOnce(res(400, { code: 'invalid_parameter', message: 'x' }));
    expect(await lead()).toEqual({ ok: false, error: 'brevo' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('missing BREVO_API_KEY → brevo without fetch', async () => {
    vi.stubEnv('BREVO_API_KEY', '');
    expect(await lead()).toEqual({ ok: false, error: 'brevo' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('upsertProfile', () => {
  it.each([
    [res(201, { id: 21 }), { ok: true }],
    [res(204), { ok: true }],
    [res(400, { code: 'duplicate_parameter', message: 'Unable to update contact, SMS is already associated with another Contact' }), { ok: false, error: 'phone_taken' }],
    [res(400, { code: 'invalid_parameter', message: 'Invalid phone number' }), { ok: false, error: 'brevo' }],
    [res(500), { ok: false, error: 'brevo' }],
  ])('response → %#', async (r, expected) => {
    fetchMock.mockResolvedValue(r);
    expect(await prof()).toEqual(expected);
  });
});
