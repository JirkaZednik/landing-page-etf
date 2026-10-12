import { createHash } from 'node:crypto';
import { env } from './env';

const GRAPH_VERSION = 'v25.0';
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function sendLeadEvent(i: {
  email: string; eventId: string; ip: string; userAgent: string; sourceUrl: string;
}): Promise<void> {
  const pixel = env('META_PIXEL_ID');
  const token = env('META_CAPI_TOKEN');
  if (!pixel || !token) return;
  const testCode = env('META_TEST_EVENT_CODE');
  try {
    const r = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixel}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          data: [{
            event_name: 'Lead',
            event_time: Math.floor(Date.now() / 1000),
            event_id: i.eventId,
            action_source: 'website',
            event_source_url: i.sourceUrl,
            user_data: { em: [sha256(i.email.trim().toLowerCase())], client_ip_address: i.ip, client_user_agent: i.userAgent },
          }],
          ...(testCode ? { test_event_code: testCode } : {}),
        }),
      },
    );
    if (!r.ok) console.error('[capi]', r.status);
  } catch (e) {
    console.error('[capi]', e instanceof Error ? e.name : 'error');
  }
}
