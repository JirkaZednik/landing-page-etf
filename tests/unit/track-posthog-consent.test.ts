// @vitest-environment jsdom
// Real posthog-js (no mock): analytics consent granted mid-page switches to persistent mode in place.
import { expect, it, vi } from 'vitest';
import { AID, startRealPosthog } from './helpers/posthog-real';

it('cookieless → consent: later events carry distinct_id = aid, one page_view, no $opt_in, URLs still aid-free', async () => {
  const { t, posthog, seen, setConsent } = await startRealPosthog(`/dekujeme?aid=${AID}`);
  await vi.waitFor(() => expect(seen.length).toBe(1));
  expect(seen[0].properties.distinct_id).toBe('$posthog_cookieless');
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  setConsent({ analytics: true, meta: false, ga4: false });
  t.track('broker_selected', { broker: 'xtb' });
  await vi.waitFor(() => expect(seen.at(-1)?.event).toBe('broker_selected'));
  expect(err.mock.calls.some((c) => String(c[0]).includes('navigation'))).toBe(false); // no reload
  expect(posthog.get_distinct_id()).toBe(AID);
  expect(seen.at(-1)!.properties.distinct_id).toBe(AID);
  expect(seen.filter((e) => e.event === 'page_view')).toHaveLength(1);
  expect(seen.map((e) => e.event)).not.toContain('$opt_in');
  expect(String(seen.at(-1)!.properties.$current_url)).not.toContain('aid=');
  expect(document.cookie).toContain('ph_phc_test_posthog');
});
