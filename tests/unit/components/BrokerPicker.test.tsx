// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../src/lib/track', () => ({ track: vi.fn(), getAid: () => 'test-aid' }));
vi.mock('../../../src/lib/pairs', async (orig) => {
  const m = await orig<typeof import('../../../src/lib/pairs')>();
  return {
    ...m,
    twinsAtBroker: vi.fn((b: string) => b === 'xtb'
      ? [{ fund: m.getFund('SPYL'), ticker: 'SPYL.DE' }, { fund: m.getFund('CSPX'), ticker: 'CSPX.UK' }] : []),
  };
});
import { track } from '../../../src/lib/track';
import { getBroker, getBrokers, twinsAtBroker } from '../../../src/lib/pairs';
import BrokerPicker from '../../../src/components/BrokerPicker';

const fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetch.mockReset();
  fetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
  vi.stubGlobal('fetch', fetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('BrokerPicker', () => {
  it('renders 5 chips in order', () => {
    render(<BrokerPicker />);
    expect(screen.getByRole('heading', { name: 'U kterého brokera máte účet?' })).toBeInTheDocument();
    // names come from brokers.json (Fio is "Fio banka" there), plus "Zatím žádný"
    expect(screen.getAllByRole('radio').map((r) => r.closest('label')!.textContent))
      .toEqual([...getBrokers().map((b) => b.name), 'Zatím žádný']);
    expect(getBrokers().map((b) => b.id)).toEqual(['xtb', 'trading212', 'fio', 'degiro']);
  });

  it('XTB shows twins with ticker and ISIN, posts profile, tracks', async () => {
    render(<BrokerPicker />);
    await userEvent.click(screen.getByRole('radio', { name: 'XTB' }));
    expect(twinsAtBroker).toHaveBeenCalledWith('xtb', 'sp500');
    const rows = screen.getAllByTestId('broker-twin');
    expect(rows[0]).toHaveTextContent('SPYL.DE'); expect(rows[0]).toHaveTextContent('IE000XZSV718');
    expect(rows[1]).toHaveTextContent('CSPX.UK'); expect(rows[1]).toHaveTextContent('IE00B5BMR087');
    expect(fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ aid: 'test-aid', broker: 'xtb', consent_text_version: '2026-10-11' });
    expect(track).toHaveBeenCalledWith('broker_selected', { broker: 'xtb' });
  });

  it('broker without verified data shows exact message', async () => {
    render(<BrokerPicker />);
    await userEvent.click(screen.getByRole('radio', { name: getBroker('fio').name }));
    expect(screen.getByText('U tohoto brokera jsme dostupnost zatím neověřili.')).toBeInTheDocument();
    expect(screen.queryAllByTestId('broker-twin')).toHaveLength(0);
  });

  it('"Zatím žádný" tracks none and does not post', async () => {
    render(<BrokerPicker />);
    await userEvent.click(screen.getByRole('radio', { name: 'Zatím žádný' }));
    expect(fetch).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('broker_selected', { broker: 'none' });
    expect(screen.getByText('V návodu najdete poplatek za nákup u každého ze čtyř brokerů, takže si můžete porovnat, kde účet založit.')).toBeInTheDocument();
  });

  it('failed profile POST does not hide the answer', async () => {
    fetch.mockRejectedValueOnce(new Error('network'));
    render(<BrokerPicker />);
    await userEvent.click(screen.getByRole('radio', { name: 'XTB' }));
    expect(screen.getAllByTestId('broker-twin')).toHaveLength(2);
  });

  it('re-selecting the broker already saved does not post again', async () => {
    render(<BrokerPicker />);
    await userEvent.click(screen.getByRole('radio', { name: 'XTB' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Zatím žádný' }));
    await userEvent.click(screen.getByRole('radio', { name: 'XTB' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Degiro' }));
    expect(fetch.mock.calls.map((c) => JSON.parse(c[1].body).broker)).toEqual(['xtb', 'degiro']);
  });
});
