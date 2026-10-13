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
// With updateEnabled a known e-mail is updated, so a 400 duplicate_parameter means an identifier
// conflict (this aid / the e-mail already belongs to another contact, Brevo wrote nothing).
// Then: one retry with a fresh aid; if that conflicts too, save without ext_id so the e-mail
// still reaches the list (broker/phone pairing is lost for this lead). The returned aid is the
// one the visitor must carry to /dekujeme; in the fallback it is the fresh aid (also sent as the
// AID attribute), so /api/profile never writes onto the contact that owns the original aid.
export async function createLeadContact(i: { email: string; aid: string; attributes: Attributes }):
  Promise<{ ok: true; aid: string } | { ok: false; error: 'brevo' }> {
  const listIds = [Number(env('BREVO_LIST_ID'))];
  const conflict = (r: Raw) => !r.ok && r.status === 400 && r.code === 'duplicate_parameter';
  const save = (aid: string) => brevoPost('/contacts', {
    email: i.email, ext_id: aid, listIds, updateEnabled: true, attributes: { ...i.attributes, AID: aid },
  });

  const first = await save(i.aid);
  if (first.ok) return { ok: true, aid: i.aid };
  if (!conflict(first)) return { ok: false, error: 'brevo' };

  const fresh = crypto.randomUUID();
  const retry = await save(fresh);
  if (retry.ok) return { ok: true, aid: fresh };
  if (!conflict(retry)) return { ok: false, error: 'brevo' };

  console.error('[brevo] ext_id conflict twice, contact saved without ext_id');
  // AID = fresh (never the original): profile data saved later must not attach to another contact.
  const last = await brevoPost('/contacts', { email: i.email, listIds, updateEnabled: true, attributes: { ...i.attributes, AID: fresh } });
  return last.ok ? { ok: true, aid: fresh } : { ok: false, error: 'brevo' };
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
