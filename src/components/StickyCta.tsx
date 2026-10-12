import { useEffect, useRef, useState } from 'react';
import { track } from '../lib/track';

const FORMS = 'form[action="/api/subscribe"]';

/** Mobile bottom bar: shown whenever no lead form is in the viewport; jumps to the nearest one. */
export default function StickyCta() {
  // Nothing renders until the first observation, so SSR/hydration never flashes a bar over the hero.
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const inView = useRef(new Set<Element>());

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const watched = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && watched.has(e.target)) inView.current.add(e.target);
        else inView.current.delete(e.target);
      }
      setReady(true);
      setVisible(inView.current.size === 0);
    });
    // Forms can appear later (client-only islands) or go away: keep the watched set in sync.
    const sync = () => {
      const now = new Set(document.querySelectorAll(FORMS));
      for (const f of now) if (!watched.has(f)) { watched.add(f); io.observe(f); }
      for (const f of watched) {
        if (now.has(f)) continue;
        watched.delete(f);
        io.unobserve(f);
        if (inView.current.delete(f)) setVisible(inView.current.size === 0);
      }
    };
    sync();
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(sync);
    mo?.observe(document.body, { childList: true, subtree: true });
    return () => { mo?.disconnect(); io.disconnect(); };
  }, []);

  // html[data-sticky-bar] (not data-sticky-cta: that marks the bar element itself and is used as a selector).
  // Reserve room at the page bottom while the fixed bar is shown, so it never covers the
  // last content or a focused element (CSS: body padding + scroll-padding, mobile only).
  const shown = ready && visible;
  useEffect(() => {
    const root = document.documentElement;
    if (shown) root.dataset.stickyBar = 'shown';
    else delete root.dataset.stickyBar;
    return () => { delete root.dataset.stickyBar; };
  }, [shown]);

  const jump = () => {
    const forms = Array.from(document.querySelectorAll<HTMLFormElement>(FORMS));
    if (!forms.length) return;
    const tops = forms.map((f) => f.getBoundingClientRect().top);
    let i = tops.findIndex((t) => t >= window.innerHeight);
    if (i === -1) {
      for (let k = tops.length - 1; k >= 0; k--) if (tops[k] < 0) { i = k; break; }
    }
    if (i === -1) i = 0;
    const form = forms[i];
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    form.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    form.querySelector<HTMLInputElement>('input[name=email]')?.focus({ preventScroll: true });
    track('sticky_cta_clicked', { target: 'form-' + i });
  };

  if (!shown) return null;

  return (
    <div data-sticky-cta className="sticky-cta">
      <button type="button" onClick={jump}>Pošlete mi návod zdarma</button>
    </div>
  );
}
