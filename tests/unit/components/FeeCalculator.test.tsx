// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../src/lib/track', () => ({
  track: vi.fn(), firePixelLead: vi.fn(), getAid: () => 'test-aid', getUtm: () => ({}),
}));
vi.mock('../../../src/lib/consent', () => ({ getConsent: vi.fn(() => null), onConsentChange: vi.fn(() => () => {}) }));
import { track } from '../../../src/lib/track';
import FeeCalculator from '../../../src/components/FeeCalculator';
import FundCard, { CALC_GROUP_EVENT } from '../../../src/components/FundCard';
import { clampInputs, COMPARISON_TER } from '../../../src/lib/calc';
import { formatCzk } from '../../../src/lib/format';
import { twinsSortedByTer } from '../../../src/lib/pairs';

const norm = (s: string) => s.replace(/[\s  ]+/g, ' ').trim();
const out = () => norm(screen.getByTestId('calc-result').textContent!);
const trackMock = vi.mocked(track);

type IoInstance = { cb: IntersectionObserverCallback; targets: Set<Element>; disconnected: boolean };
let ios: IoInstance[];
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  ios = [];
  vi.stubGlobal('IntersectionObserver', class {
    inst: IoInstance;
    constructor(cb: IntersectionObserverCallback) { this.inst = { cb, targets: new Set(), disconnected: false }; ios.push(this.inst); }
    observe(el: Element) { this.inst.targets.add(el); }
    unobserve(el: Element) { this.inst.targets.delete(el); }
    disconnect() { this.inst.disconnected = true; this.inst.targets.clear(); }
    takeRecords() { return []; }
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('FeeCalculator', () => {
  it('default sp500 output', () => {
    render(<FeeCalculator />);
    expect(out()).toContain('Celkem vložíte 720 000 Kč');
    expect(out()).toMatch(/SPYL.*0,03 %.*5 200 Kč/);
    expect(out()).toMatch(/VUAA.*0,07 %.*12 000 Kč/);
    expect(out()).toContain('Rozdíl mezi SPYL a VUAA: 6 900 Kč');
    expect(out()).toMatch(/Fond s poplatkem 1,5 % p\.a\. \(příklad\).*236 000 Kč/);
    expect(out()).toContain('Ilustrativní výpočet');
    expect(screen.getByText(/Nezahrnuje poplatky brokera, kurzové konverze, spready, daně ani tracking difference\./)).toBeInTheDocument();
    expect(document.querySelector('form input[name=placement]')).toHaveValue('calc');
    expect(COMPARISON_TER).toBe(1.5);
  });

  it('rows follow twinsSortedByTer and the calc form carries pair and inputs', () => {
    render(<FeeCalculator />);
    expect(screen.getAllByTestId('calc-row').map((r) => r.dataset.fund)).toEqual(twinsSortedByTer('sp500').map((f) => f.id));
    const f = document.querySelector('form')!;
    expect(f.querySelector('input[name=pair]')).toHaveValue('sp500');
    expect(f.querySelector('input[name=calc_deposit]')).toHaveValue('3000');
    expect(f.querySelector('input[name=calc_horizon]')).toHaveValue('20');
  });

  it.each([
    ['', clampInputs('', 20).monthly * 240],
    ['3 000', 720000],
    ['0', 500 * 240],
    ['999999', 50000 * 240],
    ['abc', clampInputs('abc', 20).monthly * 240],
  ])('monthly %j never yields NaN or negative', async (raw, deposited) => {
    render(<FeeCalculator />);
    const input = screen.getByLabelText('Měsíční vklad (Kč)');
    await user.clear(input);
    if (raw) await user.type(input, raw);
    expect(out()).not.toMatch(/NaN|Infinity|-\s?\d/);
    expect(out()).toContain(`Celkem vložíte ${norm(formatCzk(deposited))}`);
  });

  it('years out of range are clamped', async () => {
    render(<FeeCalculator />);
    const years = screen.getByLabelText('Horizont (roky)');
    await user.clear(years);
    await user.type(years, '99');
    expect(out()).toContain(`Celkem vložíte ${norm(formatCzk(3000 * 40 * 12))}`);
  });

  it('blur rewrites the fields to the clamped values and the form follows', async () => {
    render(<FeeCalculator />);
    const monthly = screen.getByLabelText('Měsíční vklad (Kč)');
    const years = screen.getByLabelText('Horizont (roky)');
    await user.clear(monthly);
    await user.type(monthly, '999999');
    await user.clear(years);
    await user.type(years, '2');
    await user.tab();
    expect(monthly).toHaveValue('50000');
    expect(years).toHaveValue('5');
    expect(document.querySelector('form input[name=calc_deposit]')).toHaveValue('50000');
    expect(document.querySelector('form input[name=calc_horizon]')).toHaveValue('5');
  });

  it('world group switches rows to world twins', async () => {
    render(<FeeCalculator />);
    await user.click(screen.getByRole('radio', { name: /celý svět/i }));
    const ids = screen.getAllByTestId('calc-row').map((r) => r.dataset.fund);
    expect(ids).toEqual(twinsSortedByTer('world').map((f) => f.id));
    expect(document.querySelector('form input[name=pair]')).toHaveValue('world');
  });

  it('offers only calcEnabled groups and honours initialGroup', () => {
    render(<FeeCalculator initialGroup="world" />);
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['sp500', 'world']);
    expect(screen.getByRole('radio', { name: /celý svět/i })).toBeChecked();
  });

  it('switches group when a fund card asks for it', () => {
    render(<FeeCalculator />);
    act(() => { window.dispatchEvent(new CustomEvent(CALC_GROUP_EVENT, { detail: 'world' })); });
    expect(screen.getByRole('radio', { name: /celý svět/i })).toBeChecked();
    act(() => { window.dispatchEvent(new CustomEvent(CALC_GROUP_EVENT, { detail: 'us-total' })); });
    expect(screen.getByRole('radio', { name: /celý svět/i })).toBeChecked();
  });

  it('a world-card click before the calculator has hydrated still preselects "Celý svět" on mount', async () => {
    const card = render(<FundCard groupId="world" onCta={vi.fn()} />);
    await user.click(screen.getByRole('link', { name: 'Spočítat poplatky v kalkulačce' }));
    card.unmount();
    render(<FeeCalculator />); // mounts (hydrates) only now
    expect(screen.getByRole('radio', { name: /celý svět/i })).toBeChecked();
    cleanup();
    // the pending choice is consumed once: a later mount starts at the default again
    render(<FeeCalculator />);
    expect(screen.getByRole('radio', { name: /S&P 500/i })).toBeChecked();
  });

  it('calc_used is debounced to one call', async () => {
    render(<FeeCalculator />);
    const input = screen.getByLabelText('Měsíční vklad (Kč)');
    await user.clear(input);
    await user.type(input, '5000');
    act(() => { vi.advanceTimersByTime(800); });
    expect(trackMock.mock.calls.filter((c) => c[0] === 'calc_used')).toEqual([['calc_used', { group: 'sp500', monthly: 5000, years: 20 }]]);
  });

  it('calc_used does not fire on first render', () => {
    render(<FeeCalculator />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(trackMock.mock.calls.filter((c) => c[0] === 'calc_used')).toEqual([]);
  });

  it('calc_result_viewed fires once on intersection', () => {
    render(<FeeCalculator />);
    const result = screen.getByTestId('calc-result');
    const io = ios.find((i) => i.targets.has(result))!;
    expect(io).toBeDefined();
    const hit = [{ isIntersecting: true, target: result, intersectionRatio: 0.6 }] as unknown as IntersectionObserverEntry[];
    act(() => {
      io.cb(hit, {} as IntersectionObserver);
      io.cb(hit, {} as IntersectionObserver);
    });
    expect(trackMock.mock.calls.filter((c) => c[0] === 'calc_result_viewed')).toEqual([['calc_result_viewed', { group: 'sp500' }]]);
    expect(io.disconnected).toBe(true);
  });
});
