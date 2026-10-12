import type { APIRoute } from 'astro';
import type { Placement } from '../../lib/types';
import { isUuid, isValidEmail } from '../../lib/validate';
import { createDoiContact } from '../../server/brevo';
import { env } from '../../server/env';
import { sendLeadEvent } from '../../server/meta-capi';
import { isSameOrigin } from '../../server/origin';
import { parseBody } from '../../server/parse-body';
import { checkRateLimit } from '../../server/ratelimit';

export const prerender = false;

const PLACEMENTS: Placement[] = ['hero', 'card', 'calc', 'preview'];

const fail = (error: 'invalid_email' | 'rate_limited' | 'server', status: number, isForm: boolean) =>
  isForm
    ? new Response(null, { status: 303, headers: { Location: `/?error=${error}#form` } })
    : Response.json({ ok: false, error }, { status });

const success = (aid: string, isForm: boolean) =>
  isForm
    ? new Response(null, { status: 303, headers: { Location: `/dekujeme?aid=${aid}` } })
    : Response.json({ ok: true, redirect: `/dekujeme?aid=${aid}` });

const clip = (s: string | undefined) => (s ?? '').trim().slice(0, 100);
const posInt = (s: string | undefined) => {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const { data, isForm } = await parseBody(request);
  if (!isSameOrigin(request)) return fail('server', 403, isForm);
  if (!(await checkRateLimit(`subscribe:${clientAddress}`))) return fail('rate_limited', 429, isForm);

  const aid = isUuid(data.aid ?? '') ? data.aid : crypto.randomUUID();
  if (data.website) return success(aid, isForm); // honeypot: silent success

  const email = (data.email ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) return fail('invalid_email', 400, isForm);

  const attributes: Record<string, string | number> = {
    AID: aid,
    PLACEMENT: PLACEMENTS.includes(data.placement as Placement) ? data.placement : 'hero',
    CONSENT_AT: new Date().toISOString(),
  };
  const text: [string, string | undefined][] = [
    ['PAIR', data.pair], ['UTM_SOURCE', data.utm_source], ['UTM_MEDIUM', data.utm_medium],
    ['UTM_CAMPAIGN', data.utm_campaign], ['UTM_CONTENT', data.utm_content],
    ['CONSENT_TEXT_VERSION', data.consent_text_version],
  ];
  for (const [k, v] of text) if (clip(v)) attributes[k] = clip(v);
  const deposit = posInt(data.calc_deposit);
  const horizon = posInt(data.calc_horizon);
  if (deposit) attributes.CALC_DEPOSIT = deposit;
  if (horizon) attributes.CALC_HORIZON = horizon;

  const r = await createDoiContact({ email, aid, attributes });
  if (!r.ok) return fail('server', 502, isForm);

  // CAPI only with marketing consent (see /cookies) and never for no-JS form posts.
  if (!isForm && data.consent_marketing === '1' && isUuid(data.event_id ?? '')) {
    await sendLeadEvent({
      email, eventId: data.event_id, ip: clientAddress,
      userAgent: request.headers.get('user-agent') ?? '',
      sourceUrl: request.headers.get('referer') ?? env('SITE_URL'),
    });
  }
  return success(aid, isForm);
};
