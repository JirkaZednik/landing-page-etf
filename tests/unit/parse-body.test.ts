// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseBody } from '../../src/server/parse-body';

const req = (body: BodyInit, type: string) =>
  new Request('https://indexak.vercel.app/api/subscribe', { method: 'POST', headers: { 'content-type': type }, body });

describe('parseBody', () => {
  it('parses JSON and stringifies scalar values', async () => {
    expect(await parseBody(req(JSON.stringify({ email: 'a@b.cz', calc_deposit: 3000, consent_call: true }), 'application/json')))
      .toEqual({ data: { email: 'a@b.cz', calc_deposit: '3000', consent_call: 'true' }, isForm: false });
  });
  it('parses x-www-form-urlencoded as form', async () => {
    expect(await parseBody(req('email=a%40b.cz&placement=hero', 'application/x-www-form-urlencoded')))
      .toEqual({ data: { email: 'a@b.cz', placement: 'hero' }, isForm: true });
  });
  it('drops nested objects/arrays and null', async () => {
    expect((await parseBody(req(JSON.stringify({ a: { b: 1 }, c: [1], d: null, e: 'x' }), 'application/json'))).data)
      .toEqual({ e: 'x' });
  });
  it('malformed JSON → empty data', async () => {
    expect(await parseBody(req('{oops', 'application/json'))).toEqual({ data: {}, isForm: false });
  });
  it('unknown content type → empty data, not form', async () => {
    expect(await parseBody(req('x', 'text/plain'))).toEqual({ data: {}, isForm: false });
  });
});
