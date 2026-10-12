// @vitest-environment jsdom
// Real posthog-js (no mock): proves what actually leaves the browser without analytics consent.
import { expect, it, vi } from 'vitest';
import { AID, startRealPosthog } from './helpers/posthog-real';

it('events on /dekujeme?aid=… without consent contain the aid nowhere ($current_url, $referrer, any property)', async () => {
  const { t, seen } = await startRealPosthog(
    `/dekujeme?aid=${AID}&utm_source=meta`,
    `https://indexak.cz/?utm_source=meta&aid=${AID}`,
  );
  t.track('thankyou_viewed');
  t.track('broker_selected', { broker: 'xtb' });
  await vi.waitFor(() => expect(seen.map((e) => e.event)).toEqual(['page_view', 'thankyou_viewed', 'broker_selected']));
  for (const e of seen) {
    expect(JSON.stringify(e)).not.toContain(AID);
    expect(JSON.stringify(e)).not.toMatch(/[?&]aid=/);
    expect(e.properties.distinct_id).toBe('$posthog_cookieless');
  }
  // the rest of the URLs survives
  expect(seen[0].properties.$current_url).toBe('http://localhost:3000/dekujeme?utm_source=meta');
  expect(seen[0].properties.$pathname).toBe('/dekujeme');
  expect(seen[0].properties.$referrer).toBe('https://indexak.cz/?utm_source=meta');
});
