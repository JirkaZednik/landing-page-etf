import { env } from './env';

/** True when Origin (or, lacking it, Referer) matches SITE_URL's origin. Missing both → false. */
export function isSameOrigin(req: Request): boolean {
  const site = env('SITE_URL');
  if (!site) return false;
  try {
    const expected = new URL(site).origin;
    const origin = req.headers.get('origin');
    if (origin) return origin === expected;
    const referer = req.headers.get('referer');
    return referer ? new URL(referer).origin === expected : false;
  } catch {
    return false;
  }
}
