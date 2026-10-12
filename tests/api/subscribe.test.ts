// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AID, EVENT_ID, SITE, UUID, bodyOf, calls, ctx, formReq, jsonReq, stubServerEnv } from './helpers';

vi.mock('../../src/server/ratelimit', () => ({ checkRateLimit: vi.fn(async () => true) }));
import { checkRateLimit } from '../../src/server/ratelimit';
import { POST, prerender } from '../../src/pages/api/subscribe';

const P = '/api/subscribe';
const full = {
  email: ' Jan.Novak@Seznam.cz ', aid: AID, event_id: EVENT_ID, pair: 'sp500', calc_deposit: '3000', calc_horizon: '20',
  placement: 'calc', utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'launch', utm_content: 'b',
  consent_text_version: '2026-10-11', consent_marketing: '0', website: '',
};
let brevo: () => Response;
let fetchMock: ReturnType<typeof vi.fn>;
const run = (r: Request) => POST(ctx(r));

beforeEach(() => {
  stubServerEnv(vi);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  brevo = () => new Response('{}', { status: 201 });
  fetchMock = vi.fn(async (url: string) =>
    String(url).includes('api.brevo.com') ? brevo() : new Response('{"events_received":1}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

describe('POST /api/subscribe', () => {
  it('is not prerendered', () => expect(prerender).toBe(false));

  it('JSON success → 200 with redirect and full Brevo DOI payload', async () => {
    const r = await run(jsonReq(P, full));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, redirect: `/dekujeme?aid=${AID}` });
    const [call] = calls(fetchMock, 'api.brevo.com');
    expect(call[0]).toBe('https://api.brevo.com/v3/contacts/doubleOptinConfirmation');
    expect((call[1] as RequestInit).headers).toMatchObject({ 'api-key': 'test-key' });
    expect(bodyOf(call)).toEqual({
      email: 'jan.novak@seznam.cz', includeListIds: [7], templateId: 12,
      redirectionUrl: `${SITE}/potvrzeno?aid=${AID}`,
      attributes: {
        AID, PAIR: 'sp500', CALC_DEPOSIT: 3000, CALC_HORIZON: 20, PLACEMENT: 'calc',
        UTM_SOURCE: 'meta', UTM_MEDIUM: 'paid', UTM_CAMPAIGN: 'launch', UTM_CONTENT: 'b',
        CONSENT_TEXT_VERSION: '2026-10-11', CONSENT_AT: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    });
  });

  it('omits empty attributes and falls back to placement hero', async () => {
    await run(jsonReq(P, { email: 'a@seznam.cz', aid: AID, placement: 'evil', consent_text_version: '2026-10-11' }));
    expect(bodyOf(calls(fetchMock, 'api.brevo.com')[0]).attributes).toEqual({
      AID, PLACEMENT: 'hero', CONSENT_TEXT_VERSION: '2026-10-11', CONSENT_AT: expect.any(String),
    });
  });

  // Review Focus 1
  it('form-encoded without aid → server generates aid, 303 to /dekujeme', async () => {
    const { aid: _aid, event_id: _eventId, ...noJs } = full;
    const r = await run(formReq(P, noJs));
    expect(r.status).toBe(303);
    const loc = r.headers.get('location')!;
    expect(loc).toMatch(/^\/dekujeme\?aid=[0-9a-f-]{36}$/);
    const newAid = loc.split('=')[1];
    expect(newAid).toMatch(UUID);
    const body = bodyOf(calls(fetchMock, 'api.brevo.com')[0]);
    expect(body.attributes.AID).toBe(newAid);
    expect(body.redirectionUrl).toBe(`${SITE}/potvrzeno?aid=${newAid}`);
  });
  it('form-encoded invalid email → 303 /?error=invalid_email#form, no Brevo', async () => {
    const r = await run(formReq(P, { ...full, email: 'jan@seznam' }));
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/?error=invalid_email#form');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('form-encoded Brevo failure → 303 /?error=server#form', async () => {
    brevo = () => new Response(null, { status: 500 });
    const r = await run(formReq(P, full));
    expect(r.headers.get('location')).toBe('/?error=server#form');
  });

  it('malformed aid → replaced by a fresh UUID', async () => {
    const r = await run(jsonReq(P, { ...full, aid: 'abc' }));
    const { redirect } = await r.json();
    expect(redirect).toMatch(/^\/dekujeme\?aid=/);
    expect(redirect).not.toContain('abc');
  });

  // Review Focus 2
  it('duplicate contact (400 duplicate_parameter) → success', async () => {
    brevo = () => new Response(JSON.stringify({ code: 'duplicate_parameter', message: 'Contact already exist' }), { status: 400 });
    const r = await run(jsonReq(P, full));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, redirect: `/dekujeme?aid=${AID}` });
  });
  it('other Brevo error → 502 server', async () => {
    brevo = () => new Response(JSON.stringify({ code: 'invalid_parameter', message: 'x' }), { status: 400 });
    const r = await run(jsonReq(P, full));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ ok: false, error: 'server' });
  });
  it('invalid email JSON → 400 invalid_email, no Brevo', async () => {
    const r = await run(jsonReq(P, { ...full, email: 'jan@@seznam.cz' }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: 'invalid_email' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honeypot filled → silent success, no Brevo, no CAPI', async () => {
    const r = await run(jsonReq(P, { ...full, website: 'https://spam.example', consent_marketing: '1' }));
    expect(await r.json()).toEqual({ ok: true, redirect: `/dekujeme?aid=${AID}` });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rate limited → 429, key subscribe:<ip>, no Brevo', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(false);
    const r = await run(jsonReq(P, full));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ ok: false, error: 'rate_limited' });
    expect(checkRateLimit).toHaveBeenCalledWith('subscribe:203.0.113.7');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('foreign Origin → 403 server (JSON) / 303 error (form), no Brevo', async () => {
    const r = await run(jsonReq(P, full, { origin: 'https://evil.example' }));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ ok: false, error: 'server' });
    const f = await run(formReq(P, full, { origin: 'https://evil.example' }));
    expect(f.headers.get('location')).toBe('/?error=server#form');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('no Origin but same-site Referer → allowed; neither → 403', async () => {
    const ok = jsonReq(P, full, { referer: `${SITE}/?utm_source=meta` }); ok.headers.delete('origin');
    expect((await run(ok)).status).toBe(200);
    const bad = jsonReq(P, full); bad.headers.delete('origin');
    expect((await run(bad)).status).toBe(403);
  });

  // Review Focus 4
  it('consent_marketing=1 via JSON → CAPI Lead with hashed email and test code', async () => {
    await run(jsonReq(P, { ...full, consent_marketing: '1' }, { referer: `${SITE}/?utm_content=b` }));
    const capi = calls(fetchMock, 'graph.facebook.com');
    expect(capi).toHaveLength(1);
    expect(capi[0][0]).toBe('https://graph.facebook.com/v25.0/1234567890/events?access_token=capi-token');
    const body = bodyOf(capi[0]);
    expect(body.test_event_code).toBe('TEST123');
    expect(body.data[0]).toEqual({
      event_name: 'Lead', event_time: expect.any(Number), event_id: EVENT_ID, action_source: 'website',
      event_source_url: `${SITE}/?utm_content=b`,
      user_data: {
        em: ['6db68d052788e70eb459463eb34370fe983ef838db65641902f02326fabc37a7'], // sha256('jan.novak@seznam.cz')
        client_ip_address: '203.0.113.7', client_user_agent: 'vitest-ua',
      },
    });
  });
  it('consent_marketing=0 → no CAPI', async () => {
    await run(jsonReq(P, full));
    expect(calls(fetchMock, 'graph.facebook.com')).toHaveLength(0);
  });
  it('form-encoded (no JS) with consent_marketing=1 → no CAPI', async () => {
    await run(formReq(P, { ...full, consent_marketing: '1' }));
    expect(calls(fetchMock, 'graph.facebook.com')).toHaveLength(0);
  });
  it('CAPI failure does not break the signup', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('api.brevo.com') ? new Response('{}', { status: 201 }) : new Response('{}', { status: 500 }));
    const r = await run(jsonReq(P, { ...full, consent_marketing: '1' }));
    expect(await r.json()).toEqual({ ok: true, redirect: `/dekujeme?aid=${AID}` });
  });
  it('a slow CAPI call does not delay the response; it is handed to Vercel waitUntil', async () => {
    let finishCapi!: () => void;
    fetchMock.mockImplementation((url: string) =>
      String(url).includes('api.brevo.com')
        ? Promise.resolve(new Response('{}', { status: 201 }))
        : new Promise<Response>((res) => { finishCapi = () => res(new Response('{}', { status: 200 })); }));
    const waitUntil = vi.fn();
    const CTX = Symbol.for('@vercel/request-context');
    (globalThis as Record<symbol, unknown>)[CTX] = { get: () => ({ waitUntil }) };
    try {
      const pending = Symbol('pending');
      const r = await Promise.race([
        run(jsonReq(P, { ...full, consent_marketing: '1' })),
        new Promise((res) => setTimeout(() => res(pending), 200)),
      ]);
      expect(r).not.toBe(pending); // answered while Meta has not replied yet
      expect(await (r as Response).json()).toEqual({ ok: true, redirect: `/dekujeme?aid=${AID}` });
      expect(calls(fetchMock, 'graph.facebook.com')).toHaveLength(1);
      expect(waitUntil).toHaveBeenCalledTimes(1);
      const kept = waitUntil.mock.calls[0][0] as Promise<void>;
      finishCapi();
      await expect(kept).resolves.toBeUndefined();
    } finally {
      delete (globalThis as Record<symbol, unknown>)[CTX];
    }
  });
  it('a rejected CAPI promise outside Vercel (no waitUntil) is caught, not unhandled', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('api.brevo.com')) return new Response('{}', { status: 201 });
      throw new TypeError('network down');
    });
    const r = await run(jsonReq(P, { ...full, consent_marketing: '1' }));
    expect(r.status).toBe(200);
    await new Promise((res) => setTimeout(res, 10));
    expect(console.error).toHaveBeenCalledWith('[capi]', 'TypeError');
  });
  it('without META_TEST_EVENT_CODE the field is omitted', async () => {
    vi.stubEnv('META_TEST_EVENT_CODE', '');
    await run(jsonReq(P, { ...full, consent_marketing: '1' }));
    expect(bodyOf(calls(fetchMock, 'graph.facebook.com')[0])).not.toHaveProperty('test_event_code');
  });
});
