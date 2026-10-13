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
const prof = () => upsertProfile({ aid: AID, phone: '+420777123456', consentCall: true, consentTextVersion: '2026-10-11' });

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
    [res(201, {}), { ok: true }],
    [res(204), { ok: true }],
    [res(400, { code: 'duplicate_parameter', message: 'Contact already exist' }), { ok: true }],
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
