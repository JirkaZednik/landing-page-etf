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
    const forms = document.querySelectorAll(FORMS);
    if (!forms.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) inView.current.add(e.target);
        else inView.current.delete(e.target);
      }
      setReady(true);
      setVisible(inView.current.size === 0);
    });
    forms.forEach((f) => io.observe(f));
    return () => io.disconnect();
  }, []);

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

  if (!ready || !visible) return null;

  return (
    <div data-sticky-cta className="sticky-cta">
      <button type="button" onClick={jump}>Pošlete mi návod zdarma</button>
    </div>
  );
}
