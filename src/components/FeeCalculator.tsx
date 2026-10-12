import { useEffect, useId, useRef, useState } from 'react';
import LeadForm from './LeadForm';
import { CALC_GROUP_EVENT, takePendingCalcGroup } from '../lib/calc-group';
import { clampInputs, computeFees, LIMITS } from '../lib/calc';
import { formatCzk, formatTer } from '../lib/format';
import { getGroup, twinsSortedByTer } from '../lib/pairs';
import { track } from '../lib/track';

type CalcGroup = 'sp500' | 'world';
type Props = { initialGroup?: CalcGroup };

const GROUPS = (['sp500', 'world'] as const).filter((id) => getGroup(id).calcEnabled);
const isCalcGroup = (v: unknown): v is CalcGroup => GROUPS.includes(v as CalcGroup);

function Cols() {
  return (
    <colgroup>
      <col className="calc__col-fund" />
      <col className="calc__col-ter" />
      <col className="calc__col-fee" />
    </colgroup>
  );
}

export default function FeeCalculator({ initialGroup }: Props) {
  const uid = useId();
  const [group, setGroup] = useState<CalcGroup>(initialGroup ?? 'sp500');
  const [monthlyRaw, setMonthlyRaw] = useState(String(LIMITS.monthly.default));
  const [yearsRaw, setYearsRaw] = useState(String(LIMITS.years.default));

  const { monthly, years } = clampInputs(monthlyRaw, yearsRaw);
  const result = computeFees({
    monthly,
    years,
    funds: twinsSortedByTer(group).map((f) => ({ id: f.id, ter: f.ter.value })),
  });
  const { rows, comparison } = result;
  const first = rows[0];
  const last = rows.at(-1);

  // A fund card ("Spočítat poplatky v kalkulačce") can preselect the group: live via the event,
  // or (clicked before this island hydrated) via the pending choice read on mount.
  useEffect(() => {
    const pending = takePendingCalcGroup();
    if (isCalcGroup(pending)) setGroup(pending);
    const onPick = (e: Event) => {
      takePendingCalcGroup();
      const id = (e as CustomEvent).detail;
      if (isCalcGroup(id)) setGroup(id);
    };
    window.addEventListener(CALC_GROUP_EVENT, onPick);
    return () => window.removeEventListener(CALC_GROUP_EVENT, onPick);
  }, []);

  // calc_used: debounced, never for the initial render.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const t = setTimeout(() => track('calc_used', { group, monthly, years }), 800);
    return () => clearTimeout(t);
  }, [group, monthly, years]);

  // calc_result_viewed: once, when half of the result is on screen.
  const resultRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef(group);
  groupRef.current = group;
  useEffect(() => {
    const el = resultRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let done = false;
    const io = new IntersectionObserver((entries) => {
      if (done || !entries.some((e) => e.isIntersecting)) return;
      done = true;
      track('calc_result_viewed', { group: groupRef.current });
      io.disconnect();
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const mId = `${uid}-monthly`;
  const yId = `${uid}-years`;

  return (
    <div className="calc">
      <div className="calc__inputs">
        <fieldset className="chips chips--2">
          <legend>Skupina fondů</legend>
          {GROUPS.map((id) => (
            <label key={id} className="chip">
              <input type="radio" name="calc-group" value={id} checked={group === id} onChange={() => setGroup(id)} />
              <span className="chip__label">{getGroup(id).label}</span>
            </label>
          ))}
        </fieldset>

        <div className="calc__field">
          <label htmlFor={mId}>Měsíční vklad (Kč)</label>
          <input
            id={mId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={monthlyRaw}
            onChange={(e) => setMonthlyRaw(e.target.value)}
            onBlur={() => setMonthlyRaw(String(monthly))}
            aria-describedby={`${mId}-hint`}
          />
          <span id={`${mId}-hint`} className="calc__hint">500–50 000 Kč</span>
        </div>

        <div className="calc__field">
          <label htmlFor={yId}>Horizont (roky)</label>
          <input
            id={yId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={yearsRaw}
            onChange={(e) => setYearsRaw(e.target.value)}
            onBlur={() => setYearsRaw(String(years))}
            aria-describedby={`${yId}-hint`}
          />
          <span id={`${yId}-hint`} className="calc__hint">5–40 let</span>
        </div>
      </div>

      <div ref={resultRef} className="calc__result" data-testid="calc-result" aria-live="polite">
        <h3 className="calc__h">Ilustrativní výpočet</h3>
        <p className="calc__deposited">Celkem vložíte <span className="calc__num">{formatCzk(result.deposited)}</span></p>

        <table className="calc__table">
          <Cols />
          <thead>
            <tr>
              <th scope="col">Fond</th>
              <th scope="col">TER</th>
              <th scope="col">Na poplatcích</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-testid="calc-row" data-fund={r.id}>
                <th scope="row" className="calc__tk">{r.id}</th>
                <td>{formatTer(r.ter)}</td>
                <td>{formatCzk(r.feesPaid)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {first && last && last !== first && (
          <p className="calc__diff">
            Rozdíl mezi {first.id} a {last.id}: <span className="calc__num">{formatCzk(last.feesPaid - first.feesPaid)}</span>
          </p>
        )}

        {/* Not an option to buy: separated by a rule and set in muted ink. */}
        <table className="calc__table calc__table--cmp">
          <Cols />
          <tbody>
            <tr>
              <th scope="row" colSpan={2}>Fond s poplatkem 1,5 % p.a. (příklad)</th>
              <td>{formatCzk(comparison.feesPaid)}</td>
            </tr>
          </tbody>
        </table>

        <p className="calc__note">
          Model je ilustrativní, ne příslib: počítá se zhodnocením 7 % ročně před náklady a vklady na konci měsíce. Nezahrnuje poplatky brokera, kurzové konverze, spready, daně ani tracking difference.
        </p>
      </div>

      <LeadForm placement="calc" pair={group} calc={{ deposit: monthly, horizon: years }} />
    </div>
  );
}
