import { track } from './track';

// One delegated listener for every `[data-source-link]` on the page (AnswerCard, WhyNot, Footer).
// Each component's <script> imports this module; ES modules evaluate once, so a click is tracked once.
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest?.('[data-source-link]');
  if (a instanceof HTMLElement && a.dataset.sourceLink) track('source_link_clicked', { fund: a.dataset.sourceLink });
});
