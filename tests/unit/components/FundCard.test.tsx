// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../src/lib/track', () => ({ track: vi.fn() }));
import { track } from '../../../src/lib/track';
import FundCard from '../../../src/components/FundCard';
import { getData, getGroup, originalsOf, twinsSortedByTer } from '../../../src/lib/pairs';
import { formatDateCz } from '../../../src/lib/format';

const norm = (s: string) => s.replace(/[\s  ]+/g, ' ').trim();

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('FundCard', () => {
  it('world: original with TER and exchange, twins with index, CTA', async () => {
    const onCta = vi.fn();
    render(<FundCard groupId="world" onCta={onCta} />);
    expect(norm(screen.getByTestId('original-row').textContent!)).toContain('0,06 %');
    expect(screen.getByTestId('original-row')).toHaveTextContent('NYSE Arca');
    const rows = screen.getAllByTestId('twin-row');
    expect(rows.map((r) => r.dataset.fund)).toEqual(twinsSortedByTer('world').map((f) => f.id));
    rows.forEach((r, i) => expect(r).toHaveTextContent(twinsSortedByTer('world')[i].index.value));
    expect(screen.queryByText('Přesné dvojče neexistuje')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Poslat návod pro tento fond' }));
    expect(onCta).toHaveBeenCalledWith('world');
  });

  it('us-total: no exact twin', () => {
    render(<FundCard groupId="us-total" onCta={vi.fn()} />);
    expect(screen.getByText('Přesné dvojče neexistuje')).toBeInTheDocument();
  });

  it('us-dividend: exact SCHD sentence, alternative marked as other index', () => {
    render(<FundCard groupId="us-dividend" onCta={vi.fn()} />);
    expect(screen.getByText('UCITS fond na index Dow Jones U.S. Dividend 100 neexistuje')).toBeInTheDocument();
    expect(screen.queryByText('Přesné dvojče neexistuje')).toBeNull();
    screen.queryAllByTestId('twin-row').forEach((r) => expect(r).toHaveTextContent('jiný index'));
  });

  it('note is shown once: the fixed line is not repeated by the group note', () => {
    render(<FundCard groupId="us-dividend" onCta={vi.fn()} />);
    const text = norm(document.body.textContent!);
    expect(text.split('Dow Jones U.S. Dividend 100 neexistuje').length - 1).toBe(1);
    expect(text).toContain('Alternativa sleduje jiný index');
  });

  it('world: group note shown in full, list headed as alternatives', () => {
    render(<FundCard groupId="world" onCta={vi.fn()} />);
    expect(screen.getByText(getGroup('world').note!)).toBeInTheDocument();
    expect(screen.queryByText('Evropská dvojčata (seřazeno podle TER)')).toBeNull();
    screen.getAllByTestId('twin-row').forEach((r) => expect(r).toHaveTextContent('jiný index'));
  });

  it('us-total with no twins: honest note, no rows, no list heading, no calculator offer, CTA still there', async () => {
    const onCta = vi.fn();
    render(<FundCard groupId="us-total" onCta={onCta} />);
    expect(screen.queryAllByTestId('twin-row')).toHaveLength(0);
    expect(screen.queryByText(/Nejbližší alternativ/)).toBeNull();
    expect(screen.queryByRole('link', { name: /kalkulačk/i })).toBeNull();
    expect(norm(document.body.textContent!)).toContain('Evropský fond s ověřenými údaji zde zatím neuvádíme.');
    await userEvent.click(screen.getByRole('button', { name: 'Poslat návod pro tento fond' }));
    expect(onCta).toHaveBeenCalledWith('us-total');
  });

  it('original row links issuer data; twin details show ISIN and source links that track clicks', async () => {
    render(<FundCard groupId="world" onCta={vi.fn()} />);
    const orig = within(screen.getByTestId('original-row')).getByRole('link', { name: 'Údaje vydavatele' });
    expect(orig).toHaveAttribute('href', originalsOf('world')[0].ter.sourceUrl);
    const first = twinsSortedByTer('world')[0];
    const row = screen.getAllByTestId('twin-row')[0];
    expect(row).toHaveTextContent(first.isin.value);
    const src = within(row).getByRole('link', { name: 'Údaje vydavatele', hidden: true });
    expect(src).toHaveAttribute('href', first.ter.sourceUrl);
    if (first.kidUrl) expect(within(row).getByRole('link', { name: 'KID', hidden: true })).toHaveAttribute('href', first.kidUrl);
    src.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(src);
    expect(track).toHaveBeenCalledWith('source_link_clicked', { fund: first.id });
  });

  it('omits the KID link when the fund has no kidUrl', () => {
    render(<FundCard groupId="us-dividend" onCta={vi.fn()} />);
    const row = screen.getAllByTestId('twin-row')[0];
    const fund = twinsSortedByTer('us-dividend')[0];
    expect(within(row).queryAllByRole('link', { name: 'KID', hidden: true })).toHaveLength(fund.kidUrl ? 1 : 0);
  });

  it('exact-twin group uses the twin heading and no "jiný index"', () => {
    render(<FundCard groupId="sp500" onCta={vi.fn()} />);
    expect(screen.getByText('Evropská dvojčata (seřazeno podle TER)')).toBeInTheDocument();
    screen.getAllByTestId('twin-row').forEach((r) => expect(r).not.toHaveTextContent('jiný index'));
  });

  it('footer shows the data date', () => {
    render(<FundCard groupId="world" onCta={vi.fn()} />);
    expect(norm(document.body.textContent!)).toContain(`Zdroj: vydavatelé fondů, k ${formatDateCz(getData().asOf)}`);
  });
});
