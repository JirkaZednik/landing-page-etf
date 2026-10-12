import type { APIContext } from 'astro';
export const SITE = 'https://indexak.vercel.app';
export const AID = '11111111-1111-4111-8111-111111111111';
export const EVENT_ID = '22222222-2222-4222-8222-222222222222';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const base = { origin: SITE, 'user-agent': 'vitest-ua' };
export const jsonReq = (path: string, body: object, headers: Record<string, string> = {}) =>
  new Request(SITE + path, { method: 'POST', headers: { ...base, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
export const formReq = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}) =>
  new Request(SITE + path, { method: 'POST', headers: { ...base, 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(fields) });
export const ctx = (request: Request) => ({ request, clientAddress: '203.0.113.7' }) as unknown as APIContext;
export function stubServerEnv(vi: typeof import('vitest').vi) {
  for (const [k, v] of Object.entries({
    BREVO_API_KEY: 'test-key', BREVO_LIST_ID: '7', BREVO_DOI_TEMPLATE_ID: '12', SITE_URL: SITE,
    META_PIXEL_ID: '1234567890', META_CAPI_TOKEN: 'capi-token', META_TEST_EVENT_CODE: 'TEST123',
    UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '',
  })) vi.stubEnv(k, v);
}
export const calls = (fetchMock: { mock: { calls: unknown[][] } }, host: string) =>
  fetchMock.mock.calls.filter(([u]) => String(u).includes(host));
export const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);
