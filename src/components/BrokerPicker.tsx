import { useId, useRef, useState } from 'react';
import { CONSENT_TEXT_VERSION } from '../lib/copy';
import { formatDateCz, formatTer } from '../lib/format';
import { getBroker, getBrokers, twinsAtBroker } from '../lib/pairs';
import { getAid, track } from '../lib/track';
import type { BrokerId } from '../lib/types';

type Choice = BrokerId | 'none';

const NONE_TEXT = 'V návodu najdete poplatek za nákup u každého ze čtyř brokerů, takže si můžete porovnat, kde účet založit.';
const UNVERIFIED_TEXT = 'U tohoto brokera jsme dostupnost zatím neověřili.';

/** "Which broker do you use?" on /dekujeme: answers instantly from verified data, saves the choice to the profile. */
export default function BrokerPicker() {
  const headingId = useId();
  const [choice, setChoice] = useState<Choice | null>(null);
  // Last broker sent to /api/profile: re-selecting it does not post again.
  const savedRef = useRef<BrokerId | null>(null);

  const select = (c: Choice) => {
    setChoice(c);
    track('broker_selected', { broker: c });
    if (c === 'none' || savedRef.current === c) return; // "none" is only measured (API BrokerId has no "none")
    savedRef.current = c;
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ aid: getAid(), broker: c, consent_text_version: CONSENT_TEXT_VERSION }),
    })
      .then((r) => { if (!r.ok && savedRef.current === c) savedRef.current = null; })
      // the answer on screen does not depend on the request; allow a retry on the next pick
      .catch(() => { if (savedRef.current === c) savedRef.current = null; });
  };

  const options: { id: Choice; name: string }[] = [
    ...getBrokers().map((b) => ({ id: b.id, name: b.name })),
    { id: 'none', name: 'Zatím žádný' },
  ];

  return (
    <div className="broker-picker">
      <h2 id={headingId}>U kterého brokera máte účet?</h2>
      <fieldset className="chips" aria-labelledby={headingId}>
        {options.map((o) => (
          <label key={o.id} className="chip">
            <input type="radio" name="broker" value={o.id} checked={choice === o.id} onChange={() => select(o.id)} />
            <span className="chip__name">{o.name}</span>
          </label>
        ))}
      </fieldset>
      <div aria-live="polite">{choice && <Answer choice={choice} />}</div>
    </div>
  );
}

function Answer({ choice }: { choice: Choice }) {
  if (choice === 'none') return <p className="broker-answer__text">{NONE_TEXT}</p>;
  const broker = getBroker(choice);
  const rows = twinsAtBroker(choice, 'sp500');
  if (rows.length === 0) return <p className="broker-answer__text">{UNVERIFIED_TEXT}</p>;
  return (
    <div className="broker-answer">
      <h3 className="broker-answer__h">S&amp;P 500 u {broker.name}</h3>
      <ul className="broker-answer__rows">
        {rows.map(({ fund, ticker }) => (
          <li key={fund.id} data-testid="broker-twin" className="broker-answer__row">
            <span className="broker-answer__tk">{ticker}</span>
            <span className="broker-answer__ter">TER {formatTer(fund.ter.value)}</span>
            <span className="broker-answer__isin">ISIN <span>{fund.isin.value}</span></span>
          </li>
        ))}
      </ul>
      <p className="broker-answer__src">Údaje ověřené k {formatDateCz(broker.asOf)}</p>
    </div>
  );
}
