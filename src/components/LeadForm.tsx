import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CONSENT_TEXT_VERSION, FORM_COPY } from '../lib/copy';
import { getConsent, onConsentChange } from '../lib/consent';
import { firePixelLead, getAid, getUtm, track } from '../lib/track';
import { isValidEmail } from '../lib/validate';
import type { Placement } from '../lib/types';

type Props = {
  placement: Placement;
  pair?: string;
  calc?: { deposit: number; horizon: number };
  id?: string;
};

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

export default function LeadForm({ placement, pair, calc, id }: Props) {
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const sendingRef = useRef(false);
  const startedRef = useRef(false);
  const viewedRef = useRef(false);

  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aid, setAid] = useState('');
  const [utm, setUtm] = useState<Record<string, string>>({});
  const [consentMarketing, setConsentMarketing] = useState('0');

  // pair, placement and calc_* are UNCONTROLLED on purpose: other islands (FundCard) overwrite
  // them in the DOM, and a controlled value would reset them on every re-render.
  const pairRef = useRef<HTMLInputElement>(null);
  const placementRef = useRef<HTMLInputElement>(null);
  const depositRef = useRef<HTMLInputElement>(null);
  const horizonRef = useRef<HTMLInputElement>(null);
  const prevProps = useRef({ placement, pair, deposit: calc?.deposit, horizon: calc?.horizon });

  useEffect(() => {
    const prev = prevProps.current;
    const next = { placement, pair, deposit: calc?.deposit, horizon: calc?.horizon };
    if (prev.placement !== next.placement && placementRef.current) placementRef.current.value = next.placement;
    if (prev.pair !== next.pair && pairRef.current) pairRef.current.value = next.pair ?? '';
    if (prev.deposit !== next.deposit && depositRef.current) depositRef.current.value = String(next.deposit ?? '');
    if (prev.horizon !== next.horizon && horizonRef.current) horizonRef.current.value = String(next.horizon ?? '');
    prevProps.current = next;
  }, [placement, pair, calc?.deposit, calc?.horizon]);

  // The elements are created once. React re-applies defaultValue to hidden inputs on every
  // re-render (which would wipe a DOM override), but skips elements whose props object is
  // identical. Later prop changes are written to the DOM by the effect above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uncontrolledHidden = useMemo(() => (
    <>
      <input ref={placementRef} type="hidden" name="placement" defaultValue={placement} />
      <input ref={pairRef} type="hidden" name="pair" defaultValue={pair ?? ''} />
      <input ref={depositRef} type="hidden" name="calc_deposit" defaultValue={calc?.deposit ?? ''} />
      <input ref={horizonRef} type="hidden" name="calc_horizon" defaultValue={calc?.horizon ?? ''} />
    </>
  ), []);

  const currentPlacement = (): string => {
    const f = formRef.current;
    return (f && String(new FormData(f).get('placement') || '')) || placement;
  };

  useEffect(() => {
    setHydrated(true);
    setAid(getAid());
    setUtm(getUtm());
    setConsentMarketing(getConsent()?.meta ? '1' : '0');
    const off = onConsentChange((c) => setConsentMarketing(c.meta ? '1' : '0'));

    if (id === 'form') {
      const e = new URLSearchParams(location.search).get('error');
      if (e) setError(e === 'invalid_email' ? FORM_COPY.errorInvalid : FORM_COPY.errorServer);
    }

    let io: IntersectionObserver | undefined;
    if (formRef.current && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        if (!viewedRef.current && entries.some((en) => en.isIntersecting)) {
          viewedRef.current = true;
          track('form_viewed', { placement: currentPlacement() });
          io?.disconnect();
        }
      }, { threshold: 0.5 });
      io.observe(formRef.current);
    }
    return () => { off(); io?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFocusEmail = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    track('form_started', { placement: currentPlacement() });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sendingRef.current) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const where = String(data.get('placement') || placement);

    if (!isValidEmail(email)) {
      setError(FORM_COPY.errorInvalid);
      track('form_error', { placement: where, error_type: 'invalid_email' });
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setError(null);
    const eventId = crypto.randomUUID();
    const body = { ...Object.fromEntries(data), event_id: eventId, email: email.trim() };

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (json?.ok === true && typeof json.redirect === 'string') {
        track('form_submitted', { placement: where });
        firePixelLead(eventId);
        location.assign(json.redirect);
        return; // button stays disabled until navigation
      }
      fail(json?.error ?? 'server', where);
    } catch {
      fail('server', where);
    }
  };

  const fail = (type: string, where: string) => {
    setError(type === 'invalid_email' ? FORM_COPY.errorInvalid : FORM_COPY.errorServer);
    track('form_error', { placement: where, error_type: type });
    sendingRef.current = false;
    setSending(false);
  };

  const emailId = `${uid}-email`;
  const errId = `${uid}-err`;

  return (
    <form
      ref={formRef}
      id={id}
      method="post"
      action="/api/subscribe"
      className="lead-form"
      noValidate={hydrated}
      onSubmit={onSubmit}
    >
      <label htmlFor={emailId}>Váš e-mail</label>
      <input
        id={emailId}
        type="email"
        name="email"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onFocus={onFocusEmail}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
      />
      <button type="submit" disabled={sending} aria-busy={sending}>{FORM_COPY.button}</button>
      {error && <p role="alert" id={errId} className="lead-form__error">{error}</p>}
      <p className="lead-form__micro">
        {FORM_COPY.micro} <a href="/zasady-ochrany-osobnich-udaju">zásady ochrany osobních údajů</a>.
      </p>

      {uncontrolledHidden}
      <input type="hidden" name="aid" value={aid} readOnly />
      <input type="hidden" name="event_id" value="" readOnly />
      {UTM_KEYS.map((k) => (
        <input key={k} type="hidden" name={k} value={utm[k] ?? ''} readOnly />
      ))}
      <input type="hidden" name="consent_text_version" value={CONSENT_TEXT_VERSION} readOnly />
      <input type="hidden" name="consent_marketing" value={consentMarketing} readOnly />

      <div className="lead-form__hp" aria-hidden="true">
        <label>Web <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>
    </form>
  );
}
