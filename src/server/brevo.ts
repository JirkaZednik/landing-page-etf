import type { BrokerId } from '../lib/types';
import { env } from './env';

type Attributes = Record<string, string | number | boolean>;
export type ProfileInput = {
  aid: string;
  broker?: BrokerId;
  phone?: string;
  consentCall?: boolean;
  consentPartners?: boolean;
  consentTextVersion: string;
};
type Raw = { ok: true } | { ok: false; status: number; code: string };

async function brevoPost(path: string, body: unknown): Promise<Raw> {
  const key = env('BREVO_API_KEY');
  if (!key) {
    console.error('[brevo] missing BREVO_API_KEY');
    return { ok: false, status: 0, code: 'no_key' };
  }
  try {
    const r = await fetch('https://api.brevo.com/v3' + path, {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 201 || r.status === 204) return { ok: true };
    let code = '';
    try {
      code = String(((await r.json()) as { code?: string }).code ?? '');
    } catch { /* empty body */ }
    console.error('[brevo]', r.status, code);
    return { ok: false, status: r.status, code };
  } catch (e) {
    console.error('[brevo]', 0, e instanceof Error ? e.name : 'error');
    return { ok: false, status: 0, code: 'network' };
  }
}

// Single opt-in: one call creates (201) or updates (204) the contact and adds it to the list;
// the Brevo automation "Contact added to list" then sends the guide. ext_id = aid is the same
// identifier upsertProfile (/api/profile) uses, so broker and phone land on this contact.
export async function createLeadContact(i: { email: string; aid: string; attributes: Attributes }):
  Promise<{ ok: true } | { ok: false; error: 'brevo' }> {
  const r = await brevoPost('/contacts', {
    email: i.email,
    ext_id: i.aid,
    listIds: [Number(env('BREVO_LIST_ID'))],
    updateEnabled: true,
    attributes: i.attributes,
  });
  if (r.ok || (r.status === 400 && r.code === 'duplicate_parameter')) return { ok: true };
  return { ok: false, error: 'brevo' };
}

export async function upsertProfile(i: ProfileInput):
  Promise<{ ok: true } | { ok: false; error: 'brevo' | 'phone_taken' }> {
  const attributes: Attributes = { AID: i.aid, CONSENT_TEXT_VERSION: i.consentTextVersion };
  if (i.broker) attributes.BROKER = i.broker;
  if (i.phone) {
    attributes.SMS = i.phone;
    attributes.CONSENT_CALL = i.consentCall === true;
    attributes.CONSENT_PARTNERS = i.consentPartners === true;
    attributes.CONSENT_CALL_AT = new Date().toISOString();
  }
  const r = await brevoPost('/contacts', { ext_id: i.aid, updateEnabled: true, attributes });
  if (r.ok) return { ok: true };
  if (r.status === 400 && r.code === 'duplicate_parameter' && i.phone) return { ok: false, error: 'phone_taken' };
  return { ok: false, error: 'brevo' };
}
