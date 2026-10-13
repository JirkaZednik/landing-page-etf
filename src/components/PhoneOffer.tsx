import { useId, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { CONSENT_TEXT_VERSION, PHONE_COPY } from '../lib/copy';
import { getAid, track } from '../lib/track';
import { normalizeCzPhone } from '../lib/validate';

type Props = { page: 'dekujeme' };
type ErrorCode = keyof typeof PHONE_COPY.errors;
type FieldError = { code: ErrorCode; field: 'phone' | 'consent' | 'form' };

const errorCode = (e: unknown): ErrorCode =>
  typeof e === 'string' && Object.hasOwn(PHONE_COPY.errors, e) ? (e as ErrorCode) : 'server'; // rate_limited → server

/** Optional phone after sign-up. Two separate, unchecked consents; (a) is required, (b) is not. */
export default function PhoneOffer({ page }: Props) {
  const uid = useId();
  const sendingRef = useRef(false);
  const [phone, setPhone] = useState('');
  const [consentCall, setConsentCall] = useState(false);
  const [consentPartners, setConsentPartners] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<FieldError | null>(null);
  const [done, setDone] = useState(false);

  const ids = {
    heading: `${uid}-h`,
    phone: `${uid}-phone`,
    call: `${uid}-call`,
    partners: `${uid}-partners`,
    err: `${uid}-err`,
  };

  const onSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sendingRef.current) return;

    if (!consentCall) return setError({ code: 'consent_required', field: 'consent' });
    const normalized = normalizeCzPhone(phone);
    if (!normalized) return setError({ code: 'invalid_phone', field: 'phone' });

    sendingRef.current = true;
    setSending(true);
    setError(null);
    const partners = consentPartners;
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          aid: getAid(),
          phone: normalized,
          consent_call: true,
          consent_partners: partners,
          consent_text_version: CONSENT_TEXT_VERSION,
        }),
      });
      const json = await res.json().catch(() => null);
      if (json?.ok === true) {
        setDone(true);
        track('phone_submitted', { page, consent_partners: partners });
        return;
      }
      const code = errorCode(json?.error);
      setError({ code, field: code === 'phone_taken' ? 'phone' : 'form' });
    } catch {
      setError({ code: 'server', field: 'form' });
    }
    sendingRef.current = false;
    setSending(false);
  };

  const message = error && <p id={ids.err} role="alert" className="phone-offer__error">{PHONE_COPY.errors[error.code]}</p>;
  // Link text inside consent (b): "zásadách zpracování osobních údajů".
  const LINKED = 'zásadách zpracování osobních údajů';
  const [before, after] = PHONE_COPY.consentPartners.split(LINKED);

  return (
    <section className="phone-offer" aria-labelledby={ids.heading}>
      <h2 id={ids.heading}>{PHONE_COPY.heading}</h2>
      <p>{PHONE_COPY.lead}</p>
      <p className="phone-offer__who">{PHONE_COPY.who}</p>

      {done ? (
        <p role="status" className="phone-offer__done">{PHONE_COPY.success}</p>
      ) : (
        <form noValidate onSubmit={onSubmit} className="phone-offer__form">
          <label htmlFor={ids.phone}>{PHONE_COPY.label}</label>
          <input
            id={ids.phone}
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            placeholder={PHONE_COPY.placeholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={error?.field === 'phone' ? true : undefined}
            aria-describedby={error?.field === 'phone' ? ids.err : undefined}
          />
          {error?.field === 'phone' && message}

          <div className="phone-offer__opt">
            <input
              id={ids.call}
              type="checkbox"
              checked={consentCall}
              onChange={(e) => setConsentCall(e.target.checked)}
              aria-invalid={error?.field === 'consent' ? true : undefined}
              aria-describedby={error?.field === 'consent' ? ids.err : undefined}
            />
            <label htmlFor={ids.call}>{PHONE_COPY.consentCall}</label>
          </div>
          {error?.field === 'consent' && message}

          <div className="phone-offer__opt">
            <input
              id={ids.partners}
              type="checkbox"
              checked={consentPartners}
              onChange={(e) => setConsentPartners(e.target.checked)}
            />
            <label htmlFor={ids.partners}>
              {before}
              <a href="/zasady-ochrany-osobnich-udaju#partneri" target="_blank" rel="noopener">{LINKED}</a>
              {after}
            </label>
          </div>

          <button type="submit" disabled={sending} aria-busy={sending}>{PHONE_COPY.button}</button>
          {error?.field === 'form' && message}
        </form>
      )}
    </section>
  );
}
