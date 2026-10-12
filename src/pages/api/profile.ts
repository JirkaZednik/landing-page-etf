import type { APIRoute } from 'astro';
import type { BrokerId } from '../../lib/types';
import { isUuid, normalizeCzPhone } from '../../lib/validate';
import { upsertProfile } from '../../server/brevo';
import { isSameOrigin } from '../../server/origin';
import { parseBody } from '../../server/parse-body';
import { checkRateLimit } from '../../server/ratelimit';

export const prerender = false;

const BROKERS: BrokerId[] = ['xtb', 'trading212', 'fio', 'degiro'];
const isTrue = (v: string | undefined) => v === 'true' || v === '1';

type Err = 'invalid_phone' | 'consent_required' | 'phone_taken' | 'rate_limited' | 'server';
const fail = (error: Err, status: number) => Response.json({ ok: false, error }, { status });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const { data } = await parseBody(request);
  if (!isSameOrigin(request)) return fail('server', 403);
  if (!(await checkRateLimit(`profile:${clientAddress}`, { limit: 20, window: '10 m' }))) return fail('rate_limited', 429);

  const aid = data.aid ?? '';
  if (!isUuid(aid)) return fail('server', 400);

  const brokerRaw = (data.broker ?? '').trim();
  if (brokerRaw && !BROKERS.includes(brokerRaw as BrokerId)) return fail('server', 400);
  const broker = brokerRaw ? (brokerRaw as BrokerId) : undefined;

  const phoneRaw = (data.phone ?? '').trim();
  let phone: string | undefined;
  if (phoneRaw) {
    const normalized = normalizeCzPhone(phoneRaw);
    if (!normalized) return fail('invalid_phone', 400);
    if (!isTrue(data.consent_call)) return fail('consent_required', 400);
    phone = normalized;
  }

  if (!broker && !phone) return Response.json({ ok: true });

  const r = await upsertProfile({
    aid,
    broker,
    phone,
    consentCall: phone ? true : undefined,
    consentPartners: phone ? isTrue(data.consent_partners) : undefined,
    consentTextVersion: data.consent_text_version || '',
  });
  if (r.ok) return Response.json({ ok: true });
  if (r.error === 'phone_taken') return fail('phone_taken', 409);
  return fail('server', 502);
};
