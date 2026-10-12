// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../src/lib/track', () => ({ track: vi.fn() }));
import { track } from '../../../src/lib/track';
import FundPicker from '../../../src/components/FundPicker';
import { getGroup } from '../../../src/lib/pairs';

let reducedMotion = false;
let formEl: HTMLFormElement;

beforeEach(() => {
  vi.clearAllMocks();
  reducedMotion = false;
  document.body.innerHTML =
    '<form id="form"><input name="email"><input type="hidden" name="pair" value="sp500"><input type="hidden" name="placement" value="hero"></form>';
  formEl = document.querySelector('#form')!;
  formEl.scrollIntoView = vi.fn();
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') && reducedMotion, media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('FundPicker', () => {
  it('renders three chips with group labels, VT selected by default', () => {
    render(<FundPicker />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(['world', 'us-total', 'us-dividend']);
    expect(screen.getByRole('radio', { name: new RegExp(`^VT\\b.*${getGroup('world').label}`) })).toBeChecked();
    expect(screen.getByTestId('original-row')).toHaveTextContent('VT');
  });

  it('chips live in a fieldset with a visible legend', () => {
    render(<FundPicker />);
    expect(screen.getByRole('group', { name: 'Vyberte americký fond' })).toBeInTheDocument();
  });

  it('selecting SCHD switches card and tracks pair_selected', async () => {
    render(<FundPicker />);
    await userEvent.click(screen.getByRole('radio', { name: /^SCHD/ }));
    expect(screen.getByText('UCITS fond na index Dow Jones U.S. Dividend 100 neexistuje')).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('pair_selected', { pair: 'us-dividend' });
  });

  it('arrow keys move the selection natively (real radios)', async () => {
    render(<FundPicker />);
    screen.getByRole('radio', { name: /^VT\b/ }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /^VTI\b/ })).toBeChecked();
    expect(screen.getByText('Přesné dvojče neexistuje')).toBeInTheDocument();
  });

  it('card CTA prefills #form, focuses email, tracks', async () => {
    render(<FundPicker />);
    await userEvent.click(screen.getByRole('button', { name: 'Poslat návod pro tento fond' }));
    expect((document.querySelector('#form input[name=pair]') as HTMLInputElement).value).toBe('world');
    expect((document.querySelector('#form input[name=placement]') as HTMLInputElement).value).toBe('card');
    expect(document.activeElement).toBe(document.querySelector('#form input[name=email]'));
    expect(formEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(track).toHaveBeenCalledWith('card_cta_clicked', { pair: 'world' });
  });

  it('CTA respects reduced motion', async () => {
    reducedMotion = true;
    render(<FundPicker />);
    await userEvent.click(screen.getByRole('radio', { name: /^VTI\b/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Poslat návod pro tento fond' }));
    expect(formEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
    expect((document.querySelector('#form input[name=pair]') as HTMLInputElement).value).toBe('us-total');
  });
});
