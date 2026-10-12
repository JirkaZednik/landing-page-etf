import { useState } from 'react';
import FundCard from './FundCard';
import { getGroup, originalsOf } from '../lib/pairs';
import { track } from '../lib/track';
import type { GroupId } from '../lib/types';

const GROUPS: GroupId[] = ['world', 'us-total', 'us-dividend'];

/** Hands the visitor over to the hero form (#form) with this fund preselected. */
function handleCta(groupId: GroupId) {
  const form = document.querySelector<HTMLFormElement>('#form');
  if (form) {
    // LeadForm keeps pair/placement uncontrolled and reads them via FormData on submit (Task 8).
    const pair = form.querySelector<HTMLInputElement>('input[name=pair]');
    const placement = form.querySelector<HTMLInputElement>('input[name=placement]');
    if (pair) pair.value = groupId;
    if (placement) placement.value = 'card';
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    form.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    form.querySelector<HTMLInputElement>('input[name=email]')?.focus({ preventScroll: true });
  }
  track('card_cta_clicked', { pair: groupId });
}

export default function FundPicker() {
  const [group, setGroup] = useState<GroupId>('world');

  const select = (id: GroupId) => {
    setGroup(id);
    track('pair_selected', { pair: id });
  };

  return (
    <div className="fund-picker">
      <fieldset className="chips">
        <legend>Vyberte americký fond</legend>
        {GROUPS.map((id) => (
          <label key={id} className="chip">
            <input
              type="radio"
              name="fund-group"
              value={id}
              checked={group === id}
              onChange={() => select(id)}
            />
            <span className="chip__tk">{originalsOf(id)[0].id}</span> <span className="chip__label">{getGroup(id).label}</span>
          </label>
        ))}
      </fieldset>
      <FundCard groupId={group} onCta={handleCta} />
    </div>
  );
}
