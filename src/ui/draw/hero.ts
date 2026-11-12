import type { Creature } from '../../core/types';
import { blinkOpen } from '../../core/anim';
import type { HeroGeo, HeroHit } from '../../core/hero';
import { IDLE_POSE, drawCreature } from './creature';
import { gradientPaint, paint, type Canvas, type SkiaApi, rect } from './common';

export { HERO_COUNT, HERO_NOTES, HERO_PICKS, heroGeometry, heroHitTest, paddedGeo, type HeroGeo, type HeroHit } from '../../core/hero';

const easeOutBounce = (k: number): number => {
  'worklet';
  const n1 = 7.5625, d1 = 2.75;
  if (k < 1 / d1) return n1 * k * k;
  if (k < 2 / d1) { const q = k - 1.5 / d1; return n1 * q * q + 0.75; }
  if (k < 2.5 / d1) { const q = k - 2.25 / d1; return n1 * q * q + 0.9375; }
  const q = k - 2.625 / d1;
  return n1 * q * q + 0.984375;
};

export const FALL_MS = 420; // how long a singer takes to drop into place in the intro
export const HIT_MS = 1000; // how long a touch keeps animating

/**
 * The hill and its singers. `introStart` (ms on the same clock as `timeMs`, or -1) makes them drop in one after another, `gap` ms apart;
 * touches are `hits` (singer index + the time of the touch) and make that singer hop, sing and release a few notes.
 */
export function drawHero(sk: SkiaApi, c: Canvas, creatures: Creature[], g: HeroGeo, width: number, timeMs: number, hits: HeroHit[], introStart: number, gap: number, still: boolean) {
  'worklet';
  const { S, xs, ys, height } = g;
  // the hill the singers stand on
  // (the hill's gradient paint is built once per size: a new shader every frame is needless garbage for the UI runtime)
  const memo = globalThis as unknown as { __heroHill?: { key: string; p: ReturnType<typeof gradientPaint> } };
  const hillKey = `${width}|${height}|${S}|${ys[0]}`;
  if (!memo.__heroHill || memo.__heroHill.key !== hillKey) memo.__heroHill = { key: hillKey, p: gradientPaint(sk, 0, ys[0]! - S * 0.34, 0, height * 1.2, ['#4A3796', '#241A5C', '#150E3A']) };
  c.drawOval(rect(-width * 0.12, ys[0]! - S * 0.34, width * 1.24, height * 1.3), memo.__heroHill.p);
  for (let i = 0; i < creatures.length; i++) {
    const x = xs[i]!, y = ys[i]!;
    // intro: drop from above with a bounce, in sequence
    let drop = 0;
    let land = -1; // ms since landing
    if (introStart >= 0) {
      const k = (timeMs - introStart - i * gap) / FALL_MS;
      if (k < 0) continue;
      if (k < 1) drop = (1 - easeOutBounce(k)) * (y + S * 2.2);
      else land = (k - 1) * FALL_MS;
    }
    // idle life: a slow breath, a blink now and then
    const ph = i * 1.7;
    const breathe = still ? 0 : Math.sin(timeMs / 640 + ph);
    let lift = Math.max(0, breathe) * S * 0.03;
    let sy = 1 + breathe * 0.025;
    let sx = 1 - breathe * 0.015;
    let mouth = 0;
    let tilt = 0;
    // touch: hop, open the mouth, release notes
    let hitAge = -1;
    for (const h of hits) if (h.i === i && timeMs - h.t >= 0 && timeMs - h.t < HIT_MS) hitAge = timeMs - h.t;
    if (hitAge >= 0) {
      const p = Math.min(1, hitAge / 420);
      lift += Math.sin(p * Math.PI) * S * 0.38;
      sy *= 1 + Math.sin(p * Math.PI) * 0.1;
      sx *= 1 - Math.sin(p * Math.PI) * 0.06;
      mouth = Math.max(0, 1 - hitAge / 760) * 0.9;
      tilt = Math.sin(hitAge / 90) * 0.07 * Math.max(0, 1 - hitAge / 700);
    }
    if (land >= 0 && land < 220) {
      const q = land / 220;
      sy *= 1 - Math.sin(q * Math.PI) * 0.16; // squash on landing
      sx *= 1 + Math.sin(q * Math.PI) * 0.1;
      mouth = Math.max(mouth, 0.7 * (1 - q));
    }
    c.drawOval(rect(x - S * 0.42, y - S * 0.05, S * 0.84, S * 0.12), paint(sk, '#0A0620', 0.35 * (drop > 0 ? 0.4 : 1)));
    drawCreature(sk, c, creatures[i]!, x, y - drop, S, { ...IDLE_POSE, sx, sy, lift, tilt, mouth, eyes: blinkOpen(timeMs, i * 977 + 13), time: still ? 0 : timeMs });
  }
  // notes rising from touched singers
  for (const h of hits) {
    const age = timeMs - h.t;
    if (age < 0 || age >= HIT_MS || h.i < 0 || h.i >= xs.length) continue;
    const k = age / HIT_MS;
    for (let n = 0; n < 3; n++) {
      const kk = Math.min(1, Math.max(0, k * 1.15 - n * 0.12));
      if (kk <= 0) continue;
      const nx = xs[h.i]! + Math.sin(kk * 5 + n * 2.1) * S * 0.28 + (n - 1) * S * 0.25;
      const ny = ys[h.i]! - S * (1.3 + kk * 0.8);
      const a = Math.sin(Math.min(1, kk) * Math.PI) * 0.95;
      const r = S * (0.085 + 0.02 * n);
      c.drawCircle(nx, ny, r, paint(sk, n === 1 ? '#FFE8A3' : '#9FE8FF', a));
      c.drawRect(rect(nx + r * 0.7, ny - r * 3.6, r * 0.42, r * 3.6), paint(sk, n === 1 ? '#FFE8A3' : '#9FE8FF', a));
    }
  }
}
