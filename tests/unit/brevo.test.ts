// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDoiContact, upsertProfile } from '../../src/server/brevo';

const AID = '11111111-1111-4111-8111-111111111111';
const res = (status: number, body?: object) => new Response(body ? JSON.stringify(body) : null, { status });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('BREVO_API_KEY', 'test-key'); vi.stubEnv('BREVO_LIST_ID', '7');
  vi.stubEnv('BREVO_DOI_TEMPLATE_ID', '12'); vi.stubEnv('SITE_URL', 'https://indexak.vercel.app');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const doi = () => createDoiContact({ email: 'jan.novak@seznam.cz', aid: AID, attributes: { AID } });
const prof = () => upsertProfile({ aid: AID, phone: '+420777123456', consentCall: true, consentTextVersion: '2026-10-11' });

describe('createDoiContact', () => {
  it.each([
    [res(201, {}), { ok: true }],
    [res(204), { ok: true }],
    [res(400, { code: 'duplicate_parameter', message: 'Contact already exist' }), { ok: true }],
    [res(400, { code: 'invalid_parameter', message: 'Invalid email address' }), { ok: false, error: 'brevo' }],
    [res(401, { code: 'unauthorized', message: 'Key not found' }), { ok: false, error: 'brevo' }],
    [res(500), { ok: false, error: 'brevo' }],
  ])('response → %#', async (r, expected) => {
    fetchMock.mockResolvedValue(r);
    expect(await doi()).toEqual(expected);
  });
  it('network error → brevo', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await doi()).toEqual({ ok: false, error: 'brevo' });
  });
  it('missing BREVO_API_KEY → brevo without fetch', async () => {
    vi.stubEnv('BREVO_API_KEY', '');
    expect(await doi()).toEqual({ ok: false, error: 'brevo' });
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
