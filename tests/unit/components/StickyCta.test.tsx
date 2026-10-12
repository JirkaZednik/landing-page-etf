// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../src/lib/track', () => ({ track: vi.fn(), getAid: () => 'test-aid', getUtm: () => ({}) }));
import { track } from '../../../src/lib/track';
import StickyCta from '../../../src/components/StickyCta';

type Entry = { target: Element; isIntersecting: boolean };
let ioCallback: (entries: Entry[]) => void;
let forms: HTMLFormElement[];
let reducedMotion = false;
const NAME = 'Pošlete mi návod zdarma';

const setTops = (tops: number[]) =>
  forms.forEach((f, i) => {
    f.getBoundingClientRect = () => ({ top: tops[i], bottom: tops[i] + 300, left: 0, right: 390, width: 390, height: 300, x: 0, y: tops[i], toJSON() {} }) as DOMRect;
  });
const showBar = () => act(() => ioCallback(forms.map((f) => ({ target: f, isIntersecting: false }))));

beforeEach(() => {
  vi.clearAllMocks();
  reducedMotion = false;
  document.body.innerHTML = '';
  forms = [0, 1, 2].map((i) => {
    const f = document.createElement('form');
    f.setAttribute('action', '/api/subscribe');
    if (i === 0) f.id = 'form';
    const input = document.createElement('input');
    input.name = 'email';
    f.appendChild(input);
    f.scrollIntoView = vi.fn();
    document.body.appendChild(f);
    return f;
  });
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: (e: Entry[]) => void) { ioCallback = cb; }
    observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
  });
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') && reducedMotion, media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('innerHeight', 844);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('StickyCta', () => {
  it('starts hidden until first observation, then shows when no form intersects', () => {
    render(<StickyCta />);
    expect(screen.queryByRole('button', { name: NAME })).toBeNull();
    showBar();
    expect(screen.getByRole('button', { name: NAME })).toBeVisible();
  });

  it('hides when any form intersects', () => {
    render(<StickyCta />);
    act(() => ioCallback([{ target: forms[2], isIntersecting: true }]));
    expect(screen.queryByRole('button', { name: NAME })).toBeNull();
  });

  it('hides again when a form scrolls into view after being shown', () => {
    render(<StickyCta />);
    showBar();
    act(() => ioCallback([{ target: forms[1], isIntersecting: true }]));
    expect(screen.queryByRole('button', { name: NAME })).toBeNull();
    act(() => ioCallback([{ target: forms[1], isIntersecting: false }]));
    expect(screen.getByRole('button', { name: NAME })).toBeVisible();
  });

  it('click scrolls to nearest form below viewport, focuses email, tracks', async () => {
    setTops([-900, 1200, 2600]);
    render(<StickyCta />);
    showBar();
    await userEvent.click(screen.getByRole('button', { name: NAME }));
    expect(forms[1].scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(forms[0].scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(forms[1].querySelector('input[name=email]'));
    expect(track).toHaveBeenCalledWith('sticky_cta_clicked', { target: 'form-1' });
  });

  it('falls back to last form above when none is below', async () => {
    setTops([-3000, -2000, -900]);
    render(<StickyCta />);
    showBar();
    await userEvent.click(screen.getByRole('button', { name: NAME }));
    expect(forms[2].scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(forms[0].scrollIntoView).not.toHaveBeenCalled();
    expect(forms[1].scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(forms[2].querySelector('input[name=email]'));
    expect(track).toHaveBeenCalledWith('sticky_cta_clicked', { target: 'form-2' });
  });

  it('jumps without smooth scrolling when reduced motion is preferred', async () => {
    reducedMotion = true;
    setTops([-900, 1200, 2600]);
    render(<StickyCta />);
    showBar();
    await userEvent.click(screen.getByRole('button', { name: NAME }));
    expect(forms[1].scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
  });
});
