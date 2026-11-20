import { AppState, Platform } from 'react-native';
import { APP_VERSION, POSTHOG_HOST, POSTHOG_KEY } from './config';

/**
 * Anonymous usage counts to PostHog (EU), with no SDK: a plain batched POST.
 * - No device id, no account, no IP (geoip off), no person profile; the id below is random per launch and never stored.
 * - Only the fixed event names and small properties listed at the call sites; no free text, no song content.
 * - Does nothing until POSTHOG_KEY is set, and never throws or blocks the game.
 */
const sessionId = `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
let queue: { event: string; properties: Record<string, string | number | boolean>; timestamp: string }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  if (!POSTHOG_KEY || queue.length === 0) { queue = []; return; }
  const batch = queue.splice(0, 50);
  try {
    await fetch(`${POSTHOG_HOST}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        batch: batch.map((e) => ({
          event: e.event, timestamp: e.timestamp, distinct_id: sessionId,
          properties: { ...e.properties, $process_person_profile: false, $geoip_disable: true, app_version: APP_VERSION, platform: Platform.OS },
        })),
      }),
    });
  } catch { /* offline or blocked: drop silently */ }
}

export function track(event: string, properties: Record<string, string | number | boolean> = {}) {
  if (!POSTHOG_KEY || __DEV__) return;
  queue.push({ event, properties, timestamp: new Date().toISOString() });
  if (queue.length >= 20) { void flush(); return; }
  if (!timer) timer = setTimeout(() => void flush(), 15000);
}

const startedAt = Date.now();
let lastResume = Date.now(), activeMs = 0, screens = 0;
export const secondsSince = (t: number) => Math.round((Date.now() - t) / 1000);

/** One call per screen change: with the time between them it shows where play stops. */
export function screenView(name: string) { screens++; track('screen', { name }); }

if (POSTHOG_KEY && !__DEV__) {
  track('session_start');
  AppState.addEventListener('change', (st) => {
    if (st === 'active') lastResume = Date.now();
    else {
      activeMs += Date.now() - lastResume;
      track('session_end', { active_s: Math.round(activeMs / 1000), total_s: secondsSince(startedAt), screens });
      void flush();
    }
  });
}
