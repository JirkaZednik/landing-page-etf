// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AID, bodyOf, calls, ctx, jsonReq, stubServerEnv } from './helpers';

vi.mock('../../src/server/ratelimit', () => ({ checkRateLimit: vi.fn(async () => true) }));
import { checkRateLimit } from '../../src/server/ratelimit';
import { POST, prerender } from '../../src/pages/api/profile';

const P = '/api/profile';
const V = '2026-10-11';
let brevo: () => Response;
let fetchMock: ReturnType<typeof vi.fn>;
const run = async (body: object, headers?: Record<string, string>) => {
  const r = await POST(ctx(jsonReq(P, body, headers)));
  return { status: r.status, json: await r.json() };
};
const sent = () => calls(fetchMock, 'api.brevo.com');

beforeEach(() => {
  stubServerEnv(vi);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  brevo = () => new Response(JSON.stringify({ id: 21 }), { status: 201 });
  fetchMock = vi.fn(async () => brevo());
  vi.stubGlobal('fetch', fetchMock);
});

describe('POST /api/profile', () => {
  it('is not prerendered', () => expect(prerender).toBe(false));

  it('broker only → upsert by ext_id with BROKER, no SMS', async () => {
    expect(await run({ aid: AID, broker: 'xtb', consent_text_version: V })).toEqual({ status: 200, json: { ok: true } });
    expect(sent()[0][0]).toBe('https://api.brevo.com/v3/contacts');
    expect(bodyOf(sent()[0])).toEqual({ ext_id: AID, updateEnabled: true, attributes: { AID, BROKER: 'xtb', CONSENT_TEXT_VERSION: V } });
  });

  it.each([
    ['777 123 456', '+420777123456'],
    ['00420 777 123 456', '+420777123456'],
    ['+420777123456', '+420777123456'],
  ])('phone %s with consent (a) without (b) → SMS %s', async (phone, sms) => {
    expect((await run({ aid: AID, phone, consent_call: true, consent_partners: false, consent_text_version: V })).json).toEqual({ ok: true });
    expect(bodyOf(sent()[0]).attributes).toEqual({
      AID, SMS: sms, CONSENT_CALL: true, CONSENT_PARTNERS: false,
      CONSENT_CALL_AT: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), CONSENT_TEXT_VERSION: V,
    });
  });
  it('consent_text_version is trimmed and clipped to 100 characters like every other free-text attribute', async () => {
    await run({ aid: AID, broker: 'xtb', consent_text_version: ` ${'x'.repeat(5000)} ` });
    expect(bodyOf(sent()[0]).attributes.CONSENT_TEXT_VERSION).toBe('x'.repeat(100));
  });
  it('phone with both consents → CONSENT_PARTNERS true', async () => {
    await run({ aid: AID, phone: '777123456', consent_call: true, consent_partners: true, consent_text_version: V });
    expect(bodyOf(sent()[0]).attributes.CONSENT_PARTNERS).toBe(true);
  });
  it.each(['+421 905 123 456', '12345', '777 123 4567'])('invalid phone %s → 400 invalid_phone, no Brevo', async (phone) => {
    expect(await run({ aid: AID, phone, consent_call: true, consent_text_version: V }))
      .toEqual({ status: 400, json: { ok: false, error: 'invalid_phone' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([undefined, false, 'false', '0'])('phone with consent_call=%s → 400 consent_required, no Brevo', async (cc) => {
    expect(await run({ aid: AID, phone: '777 123 456', consent_call: cc, consent_text_version: V }))
      .toEqual({ status: 400, json: { ok: false, error: 'consent_required' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('consent_partners without phone is ignored', async () => {
    await run({ aid: AID, broker: 'fio', consent_partners: true, consent_text_version: V });
    expect(bodyOf(sent()[0]).attributes).not.toHaveProperty('CONSENT_PARTNERS');
  });
  it('unknown broker → 400 server, no Brevo', async () => {
    expect(await run({ aid: AID, broker: 'revolut', consent_text_version: V })).toEqual({ status: 400, json: { ok: false, error: 'server' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([undefined, 'abc'])('aid=%s → 400 server', async (aid) => {
    expect((await run({ aid, broker: 'xtb', consent_text_version: V })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('nothing to save → 200 ok without Brevo', async () => {
    expect(await run({ aid: AID, consent_text_version: V })).toEqual({ status: 200, json: { ok: true } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('SMS used by another contact → 409 phone_taken', async () => {
    brevo = () => new Response(JSON.stringify({ code: 'duplicate_parameter', message: 'Unable to update contact, SMS is already associated with another Contact' }), { status: 400 });
    expect(await run({ aid: AID, phone: '777 123 456', consent_call: true, consent_text_version: V }))
      .toEqual({ status: 409, json: { ok: false, error: 'phone_taken' } });
  });
  it('Brevo failure → 502 server', async () => {
    brevo = () => new Response(null, { status: 500 });
    expect(await run({ aid: AID, broker: 'xtb', consent_text_version: V })).toEqual({ status: 502, json: { ok: false, error: 'server' } });
  });
  it('rate limited → 429, key profile:<ip>', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(false);
    expect(await run({ aid: AID, broker: 'xtb', consent_text_version: V })).toEqual({ status: 429, json: { ok: false, error: 'rate_limited' } });
    expect(checkRateLimit).toHaveBeenCalledWith('profile:203.0.113.7', { limit: 20, window: '10 m' });
  });
  it('foreign Origin → 403 server', async () => {
    expect(await run({ aid: AID, broker: 'xtb', consent_text_version: V }, { origin: 'https://evil.example' }))
      .toEqual({ status: 403, json: { ok: false, error: 'server' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
