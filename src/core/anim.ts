import { TUNING } from './tuning';

/** Squash-and-stretch amount for the beat: 1 right on the beat, decaying fast. Returns scale offsets. */
export function beatBounce(beat: number, reduceMotion = false): { sx: number; sy: number } {
  'worklet';
  if (reduceMotion || beat < 0) return { sx: 1, sy: 1 };
  const inBar = beat % TUNING.beatsPerBar;
  const frac = beat - Math.floor(beat);
  const amp = inBar < 1 ? TUNING.downbeatSquash : TUNING.beatSquash;
  const k = Math.exp(-frac * 7) * Math.cos(frac * 9); // quick spring
  return { sx: 1 + amp * k, sy: 1 - amp * k };
}

/** Mouth/limb openness 0..1 driven by the loop's onsets (beat positions within the 16-beat loop). */
export function onsetPulse(onsets: readonly number[], beat: number, decayBeats = 0.35): number {
  'worklet';
  if (beat < 0) return 0;
  const loop = TUNING.beatsPerBar * TUNING.loopBars;
  const b = beat % loop;
  let best = 0;
  for (const o of onsets) {
    let d = b - o;
    if (d < 0) d += loop;
    if (d < decayBeats) best = Math.max(best, 1 - d / decayBeats);
  }
  return best;
}

/** Slow idle breathing, 0..1..0, phase offset per creature so they do not breathe in unison. */
export function breath(timeMs: number, phase: number): number {
  'worklet';
  return 0.5 + 0.5 * Math.sin((timeMs / TUNING.breathPeriodMs) * Math.PI * 2 + phase);
}

/** Deterministic blink schedule: returns eye openness 0 (closed) .. 1 (open) at time t for a creature seed. */
export function blinkOpen(timeMs: number, seed: number): number {
  'worklet';
  // One blink per cycle of (min+max)/2 ms, started at a pseudo-random point in the first (max-min)/2 ms of the cycle, so blinks are always min..max apart
  // (3-6 s, spec) and last 140 ms. Computed directly from the cycle number: the earlier version walked every blink since time 0 on every call, so it got
  // slower the longer the game ran.
  const period = (TUNING.blinkMinMs + TUNING.blinkMaxMs) / 2;
  const spread = (TUNING.blinkMaxMs - TUNING.blinkMinMs) / 2; // gap = period +/- spread
  const n = Math.floor(timeMs / period);
  let a = (Math.imul(seed, 2654435761) ^ Math.imul(n + 1, 40503)) >>> 0;
  a = (Math.imul(a ^ (a >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
  a = (Math.imul(a ^ (a >>> 13), 3266489909) + 0x1b873593) >>> 0;
  const r = (a >>> 8) / 16777216;
  const d = timeMs - (n * period + r * spread);
  if (d < 0 || d > 140) return 1;
  return Math.abs(d - 70) / 70; // closes and re-opens
}

/** Hop arc between two points: returns position and a squash factor, p in 0..1. */
export function hop(from: { x: number; y: number }, to: { x: number; y: number }, p: number, height: number) {
  'worklet';
  const q = Math.min(1, Math.max(0, p));
  const ease = 1 - Math.pow(1 - q, 3);
  const x = from.x + (to.x - from.x) * ease;
  const y = from.y + (to.y - from.y) * ease - Math.sin(q * Math.PI) * height;
  const land = q > 0.85 ? Math.sin(((q - 0.85) / 0.15) * Math.PI) * 0.12 : 0; // squash on landing
  return { x, y, sx: 1 + land, sy: 1 - land };
}
