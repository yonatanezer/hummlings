import type { Creature } from '../../core/types';
import { doneCoinRow, doneLayout, introLayout, mapLayout, type ScreenView } from '../../core/levelscreens';
import type { Layout } from '../../core/layout';
import { IDLE_POSE, drawCreature } from './creature';
import { gradientPaint, mix, paint, radialPaint, STROKE, type Canvas, type SkiaApi, rect } from './common';

/**
 * Art of the level screens (map, success card, level banner) and the coach's hand. Everything here is drawn by the scene, in the app and in the web demo alike.
 * Helpers are declared before the functions that use them (the worklet transform only captures what is defined above it).
 */

const TAU = Math.PI * 2;

/** Deterministic pseudo-random 0..1 for index i (no state, so every frame draws the same confetti). */
export function unit(i: number): number {
  'worklet';
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}
/** Alpha in steps of 1/16: the shared paint cache is keyed by alpha, and a fade through every value would allocate a new native paint on every frame. */
export function qa(a: number): number {
  'worklet';
  return Math.round(Math.min(1, Math.max(0, a)) * 16) / 16;
}
/** 0..1 ease-out. */
function ease(k: number): number {
  'worklet';
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  return 1 - Math.pow(1 - k, 3);
}
/** 0..1 with a little overshoot (a spring). */
function springK(k: number): number {
  'worklet';
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const c1 = 1.9, c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

function starPath(sk: SkiaApi, cx: number, cy: number, R: number, r: number) {
  'worklet';
  const q = sk.PathBuilder.Make();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5, d = k % 2 ? r : R;
    if (k === 0) q.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); else q.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
  }
  q.close();
  return q.build();
}

/** A closed polygon from x, y pairs. */
function poly(sk: SkiaApi, xy: number[]) {
  'worklet';
  const q = sk.PathBuilder.Make();
  for (let i = 0; i < xy.length; i += 2) { if (i === 0) q.moveTo(xy[0]!, xy[1]!); else q.lineTo(xy[i]!, xy[i + 1]!); }
  q.close();
  return q.build();
}

/** A four-point twinkle. */
export function sparkle(sk: SkiaApi, c: Canvas, x: number, y: number, R: number, color: string, alpha: number) {
  'worklet';
  if (alpha <= 0.01 || R <= 0.5) return;
  const q = sk.PathBuilder.Make();
  q.moveTo(x, y - R); q.lineTo(x + R * 0.2, y - R * 0.2); q.lineTo(x + R, y); q.lineTo(x + R * 0.2, y + R * 0.2);
  q.lineTo(x, y + R); q.lineTo(x - R * 0.2, y + R * 0.2); q.lineTo(x - R, y); q.lineTo(x - R * 0.2, y - R * 0.2); q.close();
  c.drawPath(q.build(), paint(sk, color, qa(alpha)));
}

/** A glossy, button-like disc: a shadow underneath, a dark rim, a lit face and a highlight. */
function disc3d(sk: SkiaApi, c: Canvas, x: number, y: number, r: number, top: string, bottom: string, rim: string) {
  'worklet';
  c.drawOval(rect(x - r * 0.95, y + r * 0.82, r * 1.9, r * 0.36), paint(sk, '#000000', 0.32));
  c.drawCircle(x, y + r * 0.1, r, paint(sk, rim));
  c.drawCircle(x, y - r * 0.02, r * 0.93, gradientPaint(sk, x, y - r, x, y + r * 0.9, [top, bottom]));
  c.drawCircle(x, y - r * 0.02, r * 0.78, paint(sk, mix(top, '#FFFFFF', 0.55), 0.45, STROKE, Math.max(1.5, r * 0.05)));
  c.drawOval(rect(x - r * 0.62, y - r * 0.8, r * 1.0, r * 0.46), paint(sk, '#FFFFFF', 0.3));
}

/** A gold star with a bevel and a gloss. */
function goldStar(sk: SkiaApi, c: Canvas, x: number, y: number, R: number, alpha0: number) {
  'worklet';
  const alpha = qa(alpha0);
  c.drawPath(starPath(sk, x, y + R * 0.09, R * 1.06, R * 0.5), paint(sk, '#9A5E0E', alpha));
  c.drawPath(starPath(sk, x, y, R, R * 0.48), gradientPaint(sk, x, y - R, x, y + R, ['#FFEC9A', '#FFB62E'], alpha));
  c.drawPath(starPath(sk, x, y, R, R * 0.48), paint(sk, '#FFF7D0', 0.55 * alpha, STROKE, Math.max(1, R * 0.06)));
  c.drawOval(rect(x - R * 0.42, y - R * 0.62, R * 0.5, R * 0.3), paint(sk, '#FFFFFF', 0.5 * alpha));
}

/** A gold coin with a star and a gloss; `shine` 0..1 sweeps a glint across it. */
export function coinArt(sk: SkiaApi, c: Canvas, x: number, y: number, r: number, alpha0: number, shine: number) {
  'worklet';
  const alpha = qa(alpha0);
  c.drawCircle(x, y + r * 0.1, r, paint(sk, '#9A5E0E', alpha));
  c.drawCircle(x, y, r, gradientPaint(sk, x, y - r, x, y + r, ['#FFE48A', '#F5A71C'], alpha));
  c.drawCircle(x, y, r * 0.74, paint(sk, '#B8741A', 0.6 * alpha, STROKE, Math.max(1.2, r * 0.07)));
  c.drawPath(starPath(sk, x, y + r * 0.02, r * 0.5, r * 0.22), paint(sk, '#FFF6CC', alpha));
  c.drawOval(rect(x - r * 0.62, y - r * 0.86, r * 0.9, r * 0.38), paint(sk, '#FFFFFF', 0.32 * alpha));
  if (shine > 0 && shine < 1) sparkle(sk, c, x - r * 0.5 + r * shine, y - r * 0.5 + r * shine * 0.3, r * 0.75, '#FFFFFF', Math.sin(shine * Math.PI) * alpha);
}

/** The coach's hand: a cartoon pointing hand whose finger tip is at (x, y). `press` 0..1 squeezes it; `u` scales it. */
export function drawHand(sk: SkiaApi, c: Canvas, x0: number, y0: number, u: number, press: number, alpha0: number, floorY: number) {
  'worklet';
  const alpha = qa(alpha0);
  if (alpha <= 0.01) return;
  const x = x0, y = Math.min(y0, floorY - 68 * u); // the hand hangs below its finger tip: near the bottom edge the tip moves up so the hand is not cut off
  const s = u * (1 - 0.07 * press);
  // touch point: a soft glow under the tip, and a darker shadow of the hand on the ground
  c.drawCircle(x, y, 26 * u, radialPaint(sk, x, y, 26 * u, ['#FFFFFF', '#00000000'], 0.55 * alpha));
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.rotate(-14, 0, 0);
  const OUT = '#8A5A12';
  // outline first (every shape a little bigger), then the white shapes on top: one clean sticker edge
  const shapes = (grow: number, color: string, a: number) => {
    const p = paint(sk, color, a);
    c.drawRRect(sk.RRectXY(rect(-5.5 - grow, -grow, 11 + 2 * grow, 30 + grow), 5.5 + grow, 5.5 + grow), p); // index finger
    c.drawCircle(0, 38, 17 + grow, p); // palm
    c.drawCircle(10.5, 27, 6.4 + grow, p); // folded fingers
    c.drawCircle(16.5, 33, 6.2 + grow, p);
    c.drawCircle(-14.5, 34, 6.6 + grow, p); // thumb
  };
  c.drawOval(rect(-13, 50, 34, 11), paint(sk, '#000000', 0.22 * alpha)); // soft shadow below the wrist
  shapes(2.4, OUT, 0.95 * alpha);
  shapes(0, '#FFFFFF', alpha);
  c.drawCircle(1, 40, 11, paint(sk, '#DCE6FF', 0.55 * alpha)); // shading in the palm
  c.drawRRect(sk.RRectXY(rect(-2.8, 3, 3.2, 17), 1.6, 1.6), paint(sk, '#EAF0FF', 0.9 * alpha)); // glint on the finger
  c.restore();
}

/** A ring that grows and fades from (x, y): a tap or a landing. k = 0..1. */
export function drawBurstRing(sk: SkiaApi, c: Canvas, x: number, y: number, R: number, k: number, color: string) {
  'worklet';
  if (k <= 0 || k >= 1) return;
  c.drawCircle(x, y, R * ease(k), paint(sk, color, qa(0.7 * (1 - k)), STROKE, Math.round(4 * (1 - k)) + 1));
}

/** A ring on the floor that grows and fades (a singer lands): k = 0..1. */
export function drawFloorRing(sk: SkiaApi, c: Canvas, x: number, y: number, R: number, k: number, color: string) {
  'worklet';
  if (k <= 0 || k >= 1) return;
  const e = ease(k);
  c.drawOval(rect(x - R * e, y - R * e * 0.24, 2 * R * e, R * e * 0.48), paint(sk, color, qa(0.75 * (1 - k)), STROKE, Math.round(4 * (1 - k)) + 1));
}

/** The night of the pond for the map: sky, moon, stars, water, lily pads, reeds. */
function drawMapBackdrop(sk: SkiaApi, c: Canvas, W: number, H: number, t: number, a: number) {
  'worklet';
  c.drawRect(rect(0, 0, W, H), gradientPaint(sk, 0, 0, 0, H, ['#2C1B7C', '#170E4C', '#0A0620'], a));
  const mx = W * 0.84, my = H * 0.2;
  c.drawCircle(mx, my, H * 0.5, radialPaint(sk, mx, my, H * 0.5, ['#FFE9A8', '#00000000'], 0.3 * a));
  c.drawCircle(mx, my, H * 0.066, paint(sk, '#FFF1BE', a));
  c.drawCircle(mx - H * 0.02, my - H * 0.012, H * 0.012, paint(sk, '#EBD79A', 0.8 * a));
  c.drawCircle(mx + H * 0.018, my + H * 0.02, H * 0.008, paint(sk, '#EBD79A', 0.8 * a));
  for (let i = 0; i < 38; i++) {
    const tw = 0.5 + 0.5 * Math.sin(t / 650 + i * 1.9);
    c.drawCircle(unit(i) * W, unit(i + 50) * H * 0.62, 0.7 + unit(i + 90) * 1.5, paint(sk, '#FFFFFF', qa((0.25 + 0.6 * tw) * a))); // quantized: the paint cache then holds ~16 paints instead of one new native paint per star per frame
  }
  const y0 = H * 0.74;
  c.drawRect(rect(0, y0, W, H - y0), gradientPaint(sk, 0, y0, 0, H, ['#235C93', '#0E2850'], a));
  for (let j = 0; j < 5; j++) c.drawOval(rect(mx - (H * 0.07) * (1 - j * 0.16), y0 + 6 + j * (H - y0) * 0.17, H * 0.14 * (1 - j * 0.16), 4), paint(sk, '#FFF1BE', (0.34 - j * 0.05) * a));
  for (let j = 0; j < 3; j++) {
    const q = sk.PathBuilder.Make();
    const yy = y0 + (H - y0) * (0.2 + j * 0.28);
    for (let k = 0; k <= 28; k++) { const px = (k / 28) * W, py = yy + Math.sin(k * 0.7 + t / 900 + j * 2) * 3; if (k === 0) q.moveTo(px, py); else q.lineTo(px, py); }
    c.drawPath(q.build(), paint(sk, '#FFFFFF', 0.1 * a, STROKE, 2));
  }
  for (let i = 0; i < 5; i++) {
    const px = W * (0.12 + i * 0.2 + unit(i + 3) * 0.05), py = H * (0.84 + 0.07 * unit(i + 8)) + Math.sin(t / 1100 + i) * 1.5;
    c.drawOval(rect(px - 26, py - 8, 52, 16), paint(sk, '#2FA36B', 0.95 * a));
    c.drawOval(rect(px - 26, py - 8, 52, 16), paint(sk, '#1F7A52', 0.8 * a, STROKE, 1.5));
    if (i % 2 === 0) { c.drawCircle(px + 6, py - 6, 5, paint(sk, '#FF8FB7', a)); c.drawCircle(px + 6, py - 6, 2, paint(sk, '#FFE6EE', a)); }
  }
  for (let i = 0; i < 6; i++) {
    const left = i < 3, bx = left ? W * (0.015 + i * 0.022) : W * (0.985 - (i - 3) * 0.022), sw = Math.sin(t / 1400 + i) * 5;
    const hgt = H * (0.28 + unit(i + 20) * 0.16), tx = bx + (left ? 1 : -1) * 10 + sw;
    const q = sk.PathBuilder.Make();
    q.moveTo(bx, H * 0.86); q.quadTo(bx + (left ? 1 : -1) * 4, H * 0.86 - hgt * 0.5, tx, H * 0.86 - hgt);
    c.drawPath(q.build(), paint(sk, '#1E8F6C', 0.8 * a, STROKE, 3.2));
    if (i % 2 === 0) c.drawOval(rect(tx - 3.5, H * 0.86 - hgt - 12, 7, 20), paint(sk, '#7A4A22', 0.9 * a));
  }
}

function bez(p0: number, c1: number, c2: number, p1: number, u: number): number {
  'worklet';
  const v = 1 - u;
  return v * v * v * p0 + 3 * v * v * u * c1 + 3 * v * u * u * c2 + u * u * u * p1;
}

/** The level map: a night pond, a rope of gold along the levels done, glossy circles, a hummling that walks to the next one. Numbers and touch targets are the screen's. */
export function drawLevelMapScreen(sk: SkiaApi, c: Canvas, W: number, H: number, t: number, v: ScreenView, mascot: Creature | undefined) {
  'worklet';
  const age = t - v.since, a = ease(age / 280);
  const n = v.states.length;
  const L = mapLayout(W, H, n, v.rtl);
  drawMapBackdrop(sk, c, W, H, t, a);
  const pts = [...L.nodes, L.free];
  const allDone = v.states.every((s) => s === 'done');
  // the path: a gold rope over the finished part, dots over the rest
  for (let i = 0; i < n; i++) {
    const p0 = pts[i]!, p1 = pts[i + 1]!, pm = pts[i - 1] ?? p0, pn = pts[i + 2] ?? p1;
    const m0x = (p1.x - pm.x) / 2, m0y = (p1.y - pm.y) / 2, m1x = (pn.x - p0.x) / 2, m1y = (pn.y - p0.y) / 2;
    const c1x = p0.x + m0x / 3, c1y = p0.y + m0y / 3, c2x = p1.x - m1x / 3, c2y = p1.y - m1y / 3;
    const reveal = ease((age - 120 - i * 110) / 420);
    if (reveal <= 0) continue;
    const gold = v.states[i] === 'done';
    const q = sk.PathBuilder.Make();
    const N = 18, last = Math.max(1, Math.round(N * reveal));
    for (let k = 0; k <= last; k++) { const u = (k / N); const px = bez(p0.x, c1x, c2x, p1.x, u), py = bez(p0.y, c1y, c2y, p1.y, u); if (k === 0) q.moveTo(px, py); else q.lineTo(px, py); }
    const path = q.build();
    if (gold) {
      c.drawPath(path, paint(sk, '#000000', 0.35, STROKE, L.nodes[0]!.r * 0.46));
      c.drawPath(path, paint(sk, '#F5B02A', 1, STROKE, L.nodes[0]!.r * 0.34));
      c.drawPath(path, paint(sk, '#FFE9A0', 0.8, STROKE, L.nodes[0]!.r * 0.1));
    } else {
      for (let k = 1; k < 9 * reveal; k++) { const u = k / 9; c.drawCircle(bez(p0.x, c1x, c2x, p1.x, u), bez(p0.y, c1y, c2y, p1.y, u), L.nodes[0]!.r * 0.085, paint(sk, '#B9ABFF', 0.5)); }
    }
  }
  // circles
  pts.forEach((p, i) => {
    const isFree = i === n;
    const state = isFree ? (allDone ? 'current' : 'free') : v.states[i]!;
    const pop = springK((age - 150 - i * 120) / 480);
    if (pop <= 0.01) return;
    const bob = state === 'current' ? Math.sin(t / 360) * 0.045 : 0;
    const R = p.r * pop * (1 + bob);
    const cy = p.y - (state === 'current' ? Math.abs(Math.sin(t / 520)) * 3 : 0);
    if (state === 'current') {
      const pulse = 0.5 + 0.5 * Math.sin(t / 330);
      c.drawCircle(p.x, cy, R * 2.1, radialPaint(sk, p.x, cy, R * 2.1, ['#FFE88A', '#00000000'], 0.55 * (0.6 + 0.4 * pulse) * pop));
      c.drawCircle(p.x, cy, R * (1.22 + 0.12 * pulse), paint(sk, '#FFE066', 0.9 - 0.5 * pulse, STROKE, 4));
    }
    if (isFree) disc3d(sk, c, p.x, cy, R, '#9AF5DC', '#2EC9A0', '#16806A');
    else if (state === 'done') disc3d(sk, c, p.x, cy, R, '#FFE690', '#F3A81C', '#A86A12');
    else if (state === 'current') disc3d(sk, c, p.x, cy, R, '#FFFBE0', '#FFC857', '#C98A1E');
    else disc3d(sk, c, p.x, cy, R, '#7776A6', '#4B4A80', '#2A2950');
    if (isFree) {
      const q = sk.PathBuilder.Make();
      const dir = v.rtl ? -1 : 1;
      q.moveTo(p.x - R * 0.2 * dir, cy - R * 0.38); q.lineTo(p.x + R * 0.42 * dir, cy); q.lineTo(p.x - R * 0.2 * dir, cy + R * 0.38); q.close();
      c.drawPath(q.build(), paint(sk, '#0F3D33'));
      for (let k = 0; k < 3; k++) {
        const nx = p.x + (k - 1) * R * 0.95, ny = cy - R * 1.45 - Math.abs(Math.sin(t / 700 + k * 1.4)) * 7;
        const col = ['#FF7AA8', '#7A8CFF', '#FFC857'][k]!;
        c.drawCircle(nx, ny, R * 0.1, paint(sk, col, 0.95 * pop));
        c.drawLine(nx + R * 0.09, ny, nx + R * 0.09, ny - R * 0.34, paint(sk, col, 0.95 * pop, STROKE, 2.2));
      }
    } else if (state === 'locked') {
      const lw = R * 0.5, lh = R * 0.36, lx = p.x - lw / 2, ly = cy - R * 0.02;
      const q = sk.PathBuilder.Make();
      q.moveTo(lx + lw * 0.2, ly); q.lineTo(lx + lw * 0.2, ly - R * 0.18); q.cubicTo(lx + lw * 0.2, ly - R * 0.5, lx + lw * 0.8, ly - R * 0.5, lx + lw * 0.8, ly - R * 0.18); q.lineTo(lx + lw * 0.8, ly);
      c.drawPath(q.build(), paint(sk, '#DAD8FF', 1, STROKE, R * 0.09));
      c.drawRRect(sk.RRectXY(rect(lx, ly, lw, lh), R * 0.07, R * 0.07), paint(sk, '#DAD8FF'));
      c.drawCircle(p.x, ly + lh * 0.5, R * 0.05, paint(sk, '#4B4A80'));
    } else if (state === 'done') {
      for (let k = 0; k < 3; k++) {
        const sx = p.x + (k - 1) * R * 0.52, sy = cy + R * (k === 1 ? 1.5 : 1.38);
        goldStar(sk, c, sx, sy, R * (k === 1 ? 0.27 : 0.22), pop);
      }
    }
  });
  // the hummling that walks to the level that waits (or to free play when everything is done)
  if (mascot) {
    const target = v.level > 0 ? v.level - 1 : n;
    const from = v.hopFrom > 0 ? v.hopFrom - 1 : target;
    const hopT = (age - 800) / 900;
    const pa = pts[from]!, pb = pts[target]!;
    const k = from === target ? 1 : Math.min(1, Math.max(0, hopT));
    const e = k * k * (3 - 2 * k);
    const arrive = from === target ? 99 : Math.max(0, hopT - 1);
    const x = pa.x + (pb.x - pa.x) * e, topY = (p: { y: number; r: number }) => p.y - p.r * 0.9;
    const y = topY(pa) + (topY(pb) - topY(pa)) * e - Math.sin(Math.PI * k) * pb.r * 1.4;
    const flying = k > 0 && k < 1;
    const land = arrive < 1 ? Math.exp(-arrive * 5) * Math.sin(arrive * 22) : 0;
    const idle = Math.abs(Math.sin(t / 620)) * 4 * (arrive >= 1 || from === target ? 1 : 0);
    const size = pb.r * 1.4;
    const sc = pa.r * (1 - e) + pb.r * e;
    c.drawOval(rect(x - sc * 0.55, topY(pb) + (flying ? 0 : 0) - 2 + (topY(pa) - topY(pb)) * (1 - e), sc * 1.1, sc * 0.26), paint(sk, '#000000', 0.25 * a));
    drawCreature(sk, c, mascot, x, y - idle, size, { ...IDLE_POSE, time: t, mouth: flying ? 0.6 : 0.25 + 0.2 * Math.sin(t / 300), sx: 1 - 0.1 * land + (flying ? -0.06 : 0), sy: 1 + 0.12 * land + (flying ? 0.08 : 0), tilt: flying ? 0.12 * (pb.x > pa.x ? 1 : -1) : 0 });
    if (arrive > 0 && arrive < 0.6) { drawBurstRing(sk, c, pb.x, topY(pb), pb.r * 1.3, arrive / 0.6, '#FFE88A'); for (let i = 0; i < 6; i++) sparkle(sk, c, pb.x + Math.cos(i * 1.05) * pb.r * (0.7 + arrive * 1.6), topY(pb) - pb.r * 0.4 + Math.sin(i * 1.05) * pb.r * (0.5 + arrive), pb.r * 0.2 * (1 - arrive / 0.6), '#FFFFFF', 1 - arrive / 0.6); }
  }
  // back button and coin pill
  const b = L.back;
  c.drawCircle(b.x, b.y, b.r, paint(sk, '#1B1340', 0.94 * a));
  c.drawCircle(b.x, b.y, b.r, paint(sk, '#FFFFFF', 0.5 * a, STROKE, 2.4));
  const dirB = v.rtl ? -1 : 1;
  const bq = sk.PathBuilder.Make();
  bq.moveTo(b.x + 5 * dirB, b.y - 10); bq.lineTo(b.x - 5 * dirB, b.y); bq.lineTo(b.x + 5 * dirB, b.y + 10);
  c.drawPath(bq.build(), paint(sk, '#FFFFFF', a, STROKE, 3.6));
  const cb = L.coins;
  c.drawRRect(sk.RRectXY(rect(cb.x, cb.y, cb.w, cb.h), cb.h / 2, cb.h / 2), paint(sk, '#1B1340', 0.94 * a));
  c.drawRRect(sk.RRectXY(rect(cb.x, cb.y, cb.w, cb.h), cb.h / 2, cb.h / 2), paint(sk, '#FFC857', a, STROKE, 2.6));
  coinArt(sk, c, cb.x + 24, cb.y + cb.h / 2, 15, a, ((t / 1400) % 3) / 1);
}

/** The success card: rays, confetti, a ribbon, three stars that pop in one after another, coins that add up, and a big button. */
export function drawDoneScreen(sk: SkiaApi, c: Canvas, W: number, H: number, t: number, v: ScreenView, crs: Creature[]) {
  'worklet';
  const age = t - v.since;
  const D = doneLayout(W, H);
  const a = ease(age / 300);
  c.drawRect(rect(0, 0, W, H), paint(sk, '#07041A', 0.74 * a));
  // rays turning slowly behind the card
  const cx = W / 2, cy = D.card.y + D.card.h * 0.4;
  const rot = (t / 9000) * TAU, R = Math.max(W, H);
  const rays = sk.PathBuilder.Make();
  for (let i = 0; i < 12; i++) {
    const a0 = rot + (i / 12) * TAU, a1 = a0 + TAU / 24;
    rays.moveTo(cx, cy); rays.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); rays.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); rays.close();
  }
  c.drawPath(rays.build(), radialPaint(sk, cx, cy, R * 0.55, ['#FFE9A8', '#00000000'], 0.2 * a));
  // confetti
  const cols = ['#FF7AA8', '#FFC857', '#5FE3C0', '#7A8CFF', '#FFFFFF', '#FF9F5A'];
  for (let i = 0; i < 44; i++) {
    const local = age - unit(i + 7) * 1400;
    if (local < 0) continue;
    const speed = 60 + unit(i + 13) * 110, y = ((local * speed) / 1000) % (H + 50) - 25;
    const x = unit(i) * W + Math.sin(local / 420 + i) * 16;
    c.save();
    c.translate(x, y);
    c.rotate(((local / 7 + i * 40) % 360), 0, 0);
    const w = 5 + unit(i + 21) * 6;
    c.drawRect(rect(-w / 2, -w / 4, w, w / 2), paint(sk, cols[i % cols.length]!, 0.9));
    c.restore();
  }
  // two hummlings cheer on both sides of the card
  const per = Math.max(1, Math.floor(crs.length / 4));
  [crs[0], crs[per * 3]].forEach((cr, i) => {
    if (!cr) return;
    const kk = springK((age - 700 - i * 180) / 600), size = Math.min(D.card.x - 4, H * 0.36);
    if (kk <= 0 || size < 44) return;
    const sx = i === 0 ? D.card.x / 2 : W - D.card.x / 2, hop = Math.abs(Math.sin(t / 380 + i * 1.6)), floor = D.card.y + D.card.h - 8;
    c.drawOval(rect(sx - size * 0.5, floor - 4, size, size * 0.2), paint(sk, '#000000', 0.3 * (1 - hop * 0.5)));
    drawCreature(sk, c, cr, sx, floor + (1 - kk) * 90 - hop * size * 0.18, size, { ...IDLE_POSE, time: t, mouth: 0.85 * hop, arms: i ? 1 : -1, tilt: (i ? -1 : 1) * 0.08 * Math.sin(t / 380), sy: 1 + 0.06 * (1 - hop) });
  });
  // the card
  const k = springK((age - 60) / 520), u = D.u;
  if (k > 0.01) {
    const { card } = D;
    c.save();
    c.translate(card.x + card.w / 2, card.y + card.h / 2);
    c.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    c.translate(-(card.x + card.w / 2), -(card.y + card.h / 2));
    const cr = 28 * u;
    c.drawRRect(sk.RRectXY(rect(card.x - 4, card.y + 10, card.w + 8, card.h), cr, cr), paint(sk, '#000000', 0.45));
    c.drawRRect(sk.RRectXY(rect(card.x, card.y, card.w, card.h), cr, cr), gradientPaint(sk, 0, card.y, 0, card.y + card.h, ['#4A37B5', '#271A72', '#1B1250']));
    c.drawRRect(sk.RRectXY(rect(card.x + 7, card.y + 7, card.w - 14, card.h - 14), cr - 6, cr - 6), paint(sk, '#FFFFFF', 0.1, STROKE, 2));
    c.drawRRect(sk.RRectXY(rect(card.x, card.y, card.w, card.h), cr, cr), paint(sk, '#FFC857', 1, STROKE, 4.5));
    c.drawOval(rect(card.x + card.w * 0.12, card.y + 10, card.w * 0.76, card.h * 0.2), radialPaint(sk, card.x + card.w / 2, card.y + 30, card.w * 0.4, ['#FFFFFF', '#00000000'], 0.12));
    // ribbon
    const rb = D.ribbon, fold = rb.h * 0.5;
    c.drawPath(poly(sk, [rb.x - fold * 0.7, rb.y + rb.h * 0.25, rb.x + 8, rb.y + rb.h * 0.25, rb.x + 8, rb.y + rb.h * 1.1, rb.x - fold * 0.7, rb.y + rb.h * 1.1, rb.x - fold * 0.2, rb.y + rb.h * 0.68]), paint(sk, '#B02B5E'));
    const rx = rb.x + rb.w;
    c.drawPath(poly(sk, [rx + fold * 0.7, rb.y + rb.h * 0.25, rx - 8, rb.y + rb.h * 0.25, rx - 8, rb.y + rb.h * 1.1, rx + fold * 0.7, rb.y + rb.h * 1.1, rx + fold * 0.2, rb.y + rb.h * 0.68]), paint(sk, '#B02B5E'));
    c.drawRRect(sk.RRectXY(rect(rb.x, rb.y + 3, rb.w, rb.h), 12 * u, 12 * u), paint(sk, '#000000', 0.3));
    c.drawRRect(sk.RRectXY(rect(rb.x, rb.y, rb.w, rb.h), 12 * u, 12 * u), gradientPaint(sk, 0, rb.y, 0, rb.y + rb.h, ['#FF8DB6', '#E8457F']));
    c.drawRRect(sk.RRectXY(rect(rb.x + 3, rb.y + 3, rb.w - 6, rb.h * 0.42), 9 * u, 9 * u), paint(sk, '#FFFFFF', 0.22));
    c.drawRRect(sk.RRectXY(rect(rb.x, rb.y, rb.w, rb.h), 12 * u, 12 * u), paint(sk, '#FFE3EE', 0.9, STROKE, 2));
    c.restore();
  }
  // stars: dim slots first, the gold ones pop in one by one with a burst
  D.stars.forEach((s, i) => {
    const d = 380 + i * 280, sk0 = (age - d) / 460;
    if (k > 0.5) c.drawPath(starPath(sk, s.x, s.y, s.r, s.r * 0.48), paint(sk, '#0E0A33', 0.6));
    if (sk0 > 0) {
      const pop = springK(sk0);
      goldStar(sk, c, s.x, s.y, s.r * pop, Math.min(1, sk0 * 3));
      const b = (age - d) / 700;
      if (b > 0 && b < 1) {
        drawBurstRing(sk, c, s.x, s.y, s.r * 2.1, b, '#FFE88A');
        for (let j = 0; j < 8; j++) { const ang = (j / 8) * TAU + i, dist = s.r * (0.9 + 1.5 * ease(b)); sparkle(sk, c, s.x + Math.cos(ang) * dist, s.y + Math.sin(ang) * dist, s.r * 0.2 * (1 - b), '#FFF7C2', 1 - b); }
      }
    }
  });
  // coins
  const n = v.steps, row = doneCoinRow(D.card, D.countX, u, n), cr2 = row.r, gap = row.gap, x0 = row.x0;
  for (let i = 0; i < n; i++) {
    const kk = springK((age - 950 - i * 130) / 380);
    if (kk <= 0) continue;
    coinArt(sk, c, x0 + i * gap, D.coinsY, cr2 * kk, Math.min(1, kk * 2), ((age - 950 - i * 130 - 380) / 500));
  }
  // button
  const bk = springK((age - 1900) / 460);
  if (bk > 0.01) {
    const B = D.button, pulse = 0.5 + 0.5 * Math.sin(t / 300), R2 = B.r * bk * (1 + 0.045 * pulse);
    c.drawCircle(B.x, B.y, R2 * 1.7, radialPaint(sk, B.x, B.y, R2 * 1.7, ['#8BF2D6', '#00000000'], 0.5 * (0.5 + 0.5 * pulse)));
    disc3d(sk, c, B.x, B.y, R2, '#9AF5DC', '#2EC9A0', '#16806A');
    const dir = v.rtl ? -1 : 1;
    const q = sk.PathBuilder.Make();
    if (v.last) { q.moveTo(B.x - R2 * 0.22 * dir, B.y - R2 * 0.4); q.lineTo(B.x + R2 * 0.44 * dir, B.y); q.lineTo(B.x - R2 * 0.22 * dir, B.y + R2 * 0.4); q.close(); c.drawPath(q.build(), paint(sk, '#0F3D33')); }
    else { q.moveTo(B.x - R2 * 0.14 * dir, B.y - R2 * 0.36); q.lineTo(B.x + R2 * 0.24 * dir, B.y); q.lineTo(B.x - R2 * 0.14 * dir, B.y + R2 * 0.36); c.drawPath(q.build(), paint(sk, '#0F3D33', 1, STROKE, R2 * 0.2)); }
  }
}

/** The banner that names a level when it starts: it drops in, waits a moment, and floats away. */
export function drawIntroScreen(sk: SkiaApi, c: Canvas, l: Layout, t: number, v: ScreenView) {
  'worklet';
  const age = t - v.since;
  if (age < 0 || age > 2500) return;
  const B = introLayout(l.W, l.stageH);
  const inK = springK(age / 520), outK = ease((age - 1900) / 600);
  const a = Math.min(1, age / 200) * (1 - outK);
  const dy = (1 - inK) * -B.h * 1.4 - outK * 24;
  c.save();
  c.translate(B.x + B.w / 2, B.y + B.h / 2 + dy);
  c.scale(0.7 + 0.3 * inK, 0.7 + 0.3 * inK);
  c.translate(-B.w / 2, -B.h / 2);
  const rad = B.h * 0.42;
  c.drawRRect(sk.RRectXY(rect(-2, 8, B.w + 4, B.h), rad, rad), paint(sk, '#000000', 0.4 * a));
  c.drawRRect(sk.RRectXY(rect(0, 0, B.w, B.h), rad, rad), gradientPaint(sk, 0, 0, 0, B.h, ['#6A4BE0', '#3B279C'], a));
  c.drawRRect(sk.RRectXY(rect(5, 5, B.w - 10, B.h * 0.4), rad * 0.8, rad * 0.8), paint(sk, '#FFFFFF', 0.16 * a));
  c.drawRRect(sk.RRectXY(rect(0, 0, B.w, B.h), rad, rad), paint(sk, '#FFC857', a, STROKE, 4));
  const tw = 0.6 + 0.4 * Math.sin(t / 200);
  sparkle(sk, c, B.w * 0.1, B.h * 0.3, B.h * 0.2 * tw, '#FFE88A', a);
  sparkle(sk, c, B.w * 0.92, B.h * 0.7, B.h * 0.17 * (1.2 - tw * 0.4), '#FFE88A', a);
  c.restore();
}
