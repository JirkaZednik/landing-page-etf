import { useEffect, useRef, useState } from 'react';
import { getConsent, openConsentSettings, setConsent } from '../lib/consent';

type Draft = { analytics: boolean; meta: boolean; ga4: boolean };
const NONE: Draft = { analytics: false, meta: false, ga4: false };
const ALL: Draft = { analytics: true, meta: true, ga4: true };

const fromSaved = (): Draft => {
  const c = getConsent();
  return c ? { analytics: c.analytics, meta: c.meta, ga4: c.ga4 } : NONE;
};

export default function ConsentBanner() {
  const [open, setOpen] = useState(() => getConsent() === null);
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState<Draft>(fromSaved);
  const region = useRef<HTMLElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const [focusRegion, setFocusRegion] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      const a = document.activeElement;
      returnTo.current = a instanceof HTMLElement && a !== document.body ? a : null;
      setFocusRegion(true);
      setDraft(fromSaved());
      setSettings(true);
      setOpen(true);
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-consent-open]')) openConsentSettings();
    };
    window.addEventListener('ix:consent-open', onOpen);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('ix:consent-open', onOpen);
      document.removeEventListener('click', onClick);
    };
  }, []);

  // Lets other fixed UI (sticky CTA) step aside while the banner is shown.
  useEffect(() => {
    const root = document.documentElement;
    if (open) root.dataset.consentBanner = 'open';
    else delete root.dataset.consentBanner;
    return () => { delete root.dataset.consentBanner; };
  }, [open]);

  // Reopened by the visitor (footer link, /cookies): move focus into the region.
  useEffect(() => {
    if (open && focusRegion) {
      region.current?.focus();
      setFocusRegion(false);
    }
  }, [open, focusRegion]);

  if (!open) return null;

  const decide = (c: Draft) => {
    setConsent(c);
    setSettings(false);
    setOpen(false);
    const back = returnTo.current;
    returnTo.current = null;
    if (back?.isConnected) back.focus();
  };
  const toggle = (k: keyof Draft) => setDraft((d) => ({ ...d, [k]: !d[k] }));

  return (
    <section ref={region} tabIndex={-1} role="region" aria-label="Souhlas s cookies" className="consent">
      {!settings ? (
        <>
          <p className="consent__text">
            Bez souhlasu měříme jen anonymně a bez cookies, kolik lidí stránku navštívilo a odeslalo formulář.
            Se souhlasem použijeme analytiku PostHog, Meta Pixel a Google Analytics 4.{' '}
            <a href="/cookies">Podrobnosti o cookies</a>
          </p>
          <div className="consent__actions">
            <button type="button" className="consent__btn" onClick={() => decide(NONE)}>Odmítnout</button>
            <button type="button" className="consent__btn" onClick={() => decide(ALL)}>Přijmout</button>
            <button type="button" className="consent__link" onClick={() => { setDraft(fromSaved()); setSettings(true); }}>Nastavení</button>
          </div>
        </>
      ) : (
        <>
          <div className="consent__options">
            <label className="consent__opt">
              <input type="checkbox" checked={draft.analytics} onChange={() => toggle('analytics')} />
              <span>Analytika (PostHog)</span>
            </label>
            <label className="consent__opt">
              <input type="checkbox" checked={draft.meta} onChange={() => toggle('meta')} />
              <span>Sdílení s Meta pro měření reklam (Meta Pixel a Conversions API)</span>
            </label>
            <label className="consent__opt">
              <input type="checkbox" checked={draft.ga4} onChange={() => toggle('ga4')} />
              <span>Google Analytics 4</span>
            </label>
          </div>
          <div className="consent__actions">
            <button type="button" className="consent__btn" onClick={() => decide(draft)}>Uložit volbu</button>
          </div>
        </>
      )}
    </section>
  );
}
