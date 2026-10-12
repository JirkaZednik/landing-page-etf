import { getData, getGroup, originalsOf, twinsSortedByTer } from '../lib/pairs';
import { formatDateCz, formatTer } from '../lib/format';
import { track } from '../lib/track';
import type { GroupId } from '../lib/types';

type Props = { groupId: GroupId; onCta: (groupId: GroupId) => void };

/** Event the card sends when the visitor wants this group in the fee calculator. */
export const CALC_GROUP_EVENT = 'ix:calc-group';

// Shown only where no UCITS fund tracks the original's index or anything close (preflight T10):
// the world twins track related indexes and say so in the group note instead.
const MISSING_LINE: Partial<Record<GroupId, string>> = {
  'us-total': 'Přesné dvojče neexistuje',
  'us-dividend': 'UCITS fond na index Dow Jones U.S. Dividend 100 neexistuje',
};

/** The group note without its first sentence when that sentence is the fixed line (no repetition). */
function noteRest(note: string | undefined, line: string | undefined): string | undefined {
  if (!note) return undefined;
  if (line && note.startsWith(line)) return note.slice(line.length).replace(/^\.\s*/, '') || undefined;
  return note;
}

export default function FundCard({ groupId, onCta }: Props) {
  const group = getGroup(groupId);
  const originals = originalsOf(groupId);
  const twins = twinsSortedByTer(groupId);
  const missing = group.exactTwin ? undefined : MISSING_LINE[groupId];
  const note = group.exactTwin ? undefined : noteRest(group.note, missing);
  const heading = group.exactTwin
    ? 'Evropská dvojčata (seřazeno podle TER)'
    : twins.length > 1 ? 'Nejbližší alternativy' : 'Nejbližší alternativa';
  const asOf = formatDateCz(getData().asOf);
  const source = (fund: string) => () => track('source_link_clicked', { fund });

  return (
    <div className="fund-card" data-group={groupId}>
      {originals.map((f) => (
        <p key={f.id} className="fund-card__orig" data-testid="original-row">
          <span className="fund-card__tk">{f.id}</span> · <span className="fund-card__num">{formatTer(f.ter.value)}</span> · {f.exchange.value}{' '}
          <a href={f.ter.sourceUrl} target="_blank" rel="noopener" onClick={source(f.id)}>Údaje vydavatele</a>
        </p>
      ))}

      {twins.length > 0 ? <div className="pair-rule" aria-hidden="true">⇄</div> : <hr className="fund-card__rule" />}

      {(missing || note) && (
        <div className="fund-card__note">
          {missing && <p className="fund-card__missing">{missing}</p>}
          {note && <p>{note}</p>}
        </div>
      )}

      {twins.length > 0 && (
        <>
          <h3 className="fund-card__h">{heading}</h3>
          <ul className="fund-card__twins" role="list">
            {twins.map((f) => (
              <li key={f.id} data-testid="twin-row" data-fund={f.id}>
                <details className="twin">
                  <summary className="fund-card__row">
                    <span className="fund-card__tk">{f.id}</span>
                    <span className="fund-card__index">
                      {f.index.value}
                      {!group.exactTwin && <span className="fund-card__other"> · jiný index</span>}
                    </span>
                    <span className="fund-card__ter">{formatTer(f.ter.value)}</span>
                  </summary>
                  <div className="fund-card__more">
                    <p className="fund-card__isin">ISIN <span>{f.isin.value}</span></p>
                    <p className="fund-card__links">
                      <a href={f.ter.sourceUrl} target="_blank" rel="noopener" onClick={source(f.id)}>Údaje vydavatele</a>
                      {f.kidUrl && <a href={f.kidUrl} target="_blank" rel="noopener" onClick={source(f.id)}>KID</a>}
                    </p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="fund-card__foot">
        <button type="button" className="fund-card__cta" onClick={() => onCta(groupId)}>Poslat návod pro tento fond</button>
        {group.calcEnabled && twins.length > 0 && (
          <a
            href="#kalkulacka"
            className="fund-card__calc"
            onClick={() => window.dispatchEvent(new CustomEvent(CALC_GROUP_EVENT, { detail: groupId }))}
          >
            Spočítat poplatky v kalkulačce
          </a>
        )}
        <p className="fund-card__src">Zdroj: <a href="#zdroje">vydavatelé fondů</a>, k {asOf}</p>
      </div>
    </div>
  );
}
