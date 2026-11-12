import type { Layout } from '../../core/layout';
import type { StagePalette } from '../../core/types';
import { gradientPaint, mix, freshPaint, paint, STROKE, type Canvas, type SkiaApi, rect } from './common';

const rnd = (i: number): number => {
  'worklet';
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function floorClip(sk: SkiaApi, c: Canvas, l: Layout) {
  'worklet';
  const fy = l.stageH * 0.93 + l.H * 0.055;
  c.clipRRect(sk.RRectXY(rect(l.W / 2 - l.W * 0.55, fy - l.H * 0.25, l.W * 1.1, l.H * 0.5), l.W * 0.55, l.H * 0.25), 1, true);
}

function poly(sk: SkiaApi, c: Canvas, pts: number[], p: ReturnType<typeof paint>) {
  'worklet';
  const b = sk.PathBuilder.Make();
  b.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) b.lineTo(pts[i]!, pts[i + 1]!);
  b.close();
  c.drawPath(b.build(), p);
}

/** Per-world backdrop and floor pattern: moonlit water, ferris wheel fair, cloud town, neon skyline, frosty peaks. Pure function of time. */
export function drawScenery(sk: SkiaApi, c: Canvas, id: string, l: Layout, pal: StagePalette, t: number, layer: 'all' | 'static' | 'live') {
  'worklet';
  // 'static' parts never move (cached as one picture per stage/size; neon windows re-record every 1.8 s), 'live' parts move every frame.
  const S = layer !== 'live', L = layer !== 'static';
  const { W, H } = l;
  const fy = l.stageH * 0.93 + H * 0.055;
  c.save();
  if (id === 'pond') {
    const mx = W * 0.7, my = H * 0.27, mr = H * 0.085; // clear of the world emblem in the top corner
    if (S) {
      c.drawCircle(mx, my, mr * 3, paint(sk, '#FFF6C8', 0.12));
      c.drawCircle(mx, my, mr, paint(sk, '#FFF6D0'));
      for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.13], [-0.1, 0.35, 0.1]] as const) c.drawCircle(mx + dx * mr, my + dy * mr, r * mr, paint(sk, '#E8DFA8'));
    }
    if (L) for (const [x, hgt] of [[0.02, 0.2], [0.045, 0.28], [0.07, 0.18], [0.93, 0.22], [0.96, 0.3], [0.985, 0.16]] as const) {
      const bx = W * x, by = l.stageH * 0.84, sway = Math.sin(t / 900 + x * 9) * 6;
      const b = sk.PathBuilder.Make(); b.moveTo(bx, by); b.quadTo(bx + sway, by - H * hgt * 0.5, bx + 6, by - H * hgt);
      c.drawPath(b.build(), paint(sk, '#5FE3C0', 0.7, STROKE, 3));
      c.drawOval(rect(bx + 3, by - H * hgt - 8, 6, 16), paint(sk, '#B07A4C'));
    }
    c.save(); floorClip(sk, c, l);
    if (L) for (let i = 0; i < 9; i++) {
      const y = fy - H * 0.2 + i * H * 0.05;
      const b = sk.PathBuilder.Make(); b.moveTo(0, y);
      for (let x = 14; x <= W; x += 14) b.lineTo(x, y + Math.sin(x / 40 + t / 700 + i) * 2.2);
      c.drawPath(b.build(), paint(sk, '#9FE8FF', 0.18, STROKE, 1.5));
    }
    if (S) c.drawRect(rect(mx - mr * 0.5, fy - H * 0.2, mr, H * 0.3), gradientPaint(sk, 0, fy - H * 0.2, 0, fy + H * 0.05, ['#FFF6C8', '#00000000'], 0.22));
    c.restore();
  } else if (id === 'fair') {
    const cx = W * 0.17, cy = l.stageH * 0.46, R = H * 0.19, a0 = t / 9000;
    if (S) {
      c.drawCircle(cx, cy, R, paint(sk, '#FFD6E8', 0.55, STROKE, 2.5));
      c.drawCircle(cx, cy, R * 0.12, paint(sk, '#FFD6E8', 0.55, STROKE, 2.5));
      c.drawLine(cx - R * 0.45, cy + R * 1.4, cx, cy, paint(sk, '#FFD6E8', 0.55, STROKE, 2.5));
      c.drawLine(cx + R * 0.45, cy + R * 1.4, cx, cy, paint(sk, '#FFD6E8', 0.55, STROKE, 2.5));
    }
    const cols = ['#FF7AA8', '#FFC857', '#5FE3C0', '#7A8CFF'];
    if (L) for (let i = 0; i < 8; i++) {
      const a = a0 + (i * Math.PI) / 4, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      c.drawLine(cx, cy, x, y, paint(sk, '#FFD6E8', 0.55, STROKE, 2.5));
      c.drawRRect(sk.RRectXY(rect(x - 8, y, 16, 13), 4, 4), paint(sk, cols[i % 4]!, 0.85));
    }
    if (S) for (let i = 0; i < 2; i++) {
      const x = W * 0.83 + i * 70, base = l.stageH * 0.55;
      poly(sk, c, [x - 35, base, x, base - 52, x + 35, base], paint(sk, i ? '#FFC857' : '#FF7AA8', 0.66));
      c.drawRect(rect(x - 35, base, 70, 26), paint(sk, '#FFFFFF', 0.13));
    }
    c.save(); floorClip(sk, c, l);
    if (S) for (let i = -12; i < 14; i++) poly(sk, c, [W / 2 + i * 60 - 20, fy - H * 0.25, W / 2 + i * 60 + 40, fy - H * 0.25, W / 2 + i * 90 + 70, fy + H * 0.3, W / 2 + i * 90 - 20, fy + H * 0.3], paint(sk, i % 2 ? '#FFFFFF' : '#000000', i % 2 ? 0.07 : 0.09));
    c.restore();
  } else if (id === 'clouds') {
    const mx = W * 0.8, my = H * 0.22, mr = H * 0.08;
    if (S) {
      c.drawCircle(mx, my, mr, paint(sk, '#FFF4D2'));
      c.drawCircle(mx + mr * 0.45, my - mr * 0.15, mr * 0.9, paint(sk, pal.sky));
    }
    for (let i = 0; i < 6; i++) {
      const hx = W * (0.08 + i * 0.16) + (i % 2) * 14, hy = l.stageH * 0.62, hw = 34 + (i % 3) * 8, hh = 26 + (i % 2) * 12;
      if (S) {
        for (const [dx, dy, r] of [[0, 8, 30], [26, 12, 24], [-24, 12, 22]] as const) c.drawCircle(hx + dx, hy + dy, r, paint(sk, '#E8F6FF', 0.8));
        c.drawRect(rect(hx - hw / 2, hy - hh, hw, hh), paint(sk, '#FFE8A3'));
        poly(sk, c, [hx - hw / 2 - 4, hy - hh, hx, hy - hh - 18, hx + hw / 2 + 4, hy - hh], paint(sk, '#7A8CFF'));
      }
      if (L) c.drawRect(rect(hx - 4, hy - hh * 0.65, 8, 9), paint(sk, '#FFAA3C', 0.6 + 0.3 * Math.sin(t / 700 + i)));
    }
    c.save(); floorClip(sk, c, l);
    if (S) for (let i = 0; i < 18; i++) c.drawCircle(W * (i / 17), fy - H * 0.17 + (i % 3) * 10, 26, paint(sk, '#FFFFFF', 0.11));
    c.restore();
  } else if (id === 'neon') {
    const hor = l.stageH * 0.6;
    const cols = ['#FF4DD2', '#7DF9FF', '#FFE066', '#C8B6FF'];
    if (S) {
      c.drawCircle(W * 0.82, H * 0.2, H * 0.075 + 5, paint(sk, '#FF4DD2', 0.2, STROKE, 8));
      c.drawCircle(W * 0.82, H * 0.2, H * 0.075, paint(sk, '#FF4DD2', 1, STROKE, 3));
    }
    if (S) for (let i = 0; i < 13; i++) {
      const bw = W * (0.045 + ((i * 37) % 5) * 0.008), bx = W * (i / 13) + 4, bh = l.stageH * (0.22 + ((i * 53) % 7) * 0.05);
      c.drawRect(rect(bx, hor - bh, bw, bh), paint(sk, '#0D1530'));
      c.drawRect(rect(bx, hor - bh, bw, bh), paint(sk, cols[i % 4]!, 0.4, STROKE, 1.5));
      for (let wy = 0; wy < bh - 10; wy += 14) for (let wx = 5; wx < bw - 8; wx += 11) {
        const on = Math.sin(i * 7.3 + wy * 0.9 + wx * 1.7 + Math.floor(t / 1800)) > 0.2;
        c.drawRect(rect(bx + wx, hor - bh + wy + 6, 5, 6), paint(sk, on ? cols[(i + wy) % 4]! : '#FFFFFF', on ? 0.8 : 0.06));
      }
    }
    // a neon sign made of bars (no text needed)
    if (L) {
      const sx = W * 0.07, sy = l.stageH * 0.26, flick = 0.7 + 0.3 * Math.sin(t / 220);
      c.drawRRect(sk.RRectXY(rect(sx, sy, 70, 30), 8, 8), paint(sk, '#7DF9FF', 0.3 * flick, STROKE, 8));
      c.drawRRect(sk.RRectXY(rect(sx, sy, 70, 30), 8, 8), paint(sk, '#7DF9FF', flick, STROKE, 3));
      c.drawLine(sx + 14, sy + 10, sx + 56, sy + 10, paint(sk, '#FF4DD2', flick, STROKE, 3));
      c.drawLine(sx + 14, sy + 20, sx + 40, sy + 20, paint(sk, '#FFE066', flick, STROKE, 3));
    }
    c.save(); floorClip(sk, c, l);
    if (S) for (let i = -14; i <= 14; i++) c.drawLine(W / 2 + i * 14, fy - H * 0.2, W / 2 + i * 120, fy + H * 0.3, paint(sk, '#7DF9FF', 0.25, STROKE, 1.5));
    if (L) for (let k = 0; k < 8; k++) { const u = Math.pow((k + ((t / 1800) % 1)) / 8, 2); c.drawLine(0, fy - H * 0.2 + u * H * 0.5, W, fy - H * 0.2 + u * H * 0.5, paint(sk, '#7DF9FF', 0.25, STROKE, 1.5)); }
    c.restore();
  } else if (id === 'frost') {
    if (L) for (let k = 0; k < 3; k++) { // aurora ribbons
      const b = sk.PathBuilder.Make(); b.moveTo(0, l.stageH * (0.18 + k * 0.07));
      for (let x = 24; x <= W; x += 24) b.lineTo(x, l.stageH * (0.16 + k * 0.07) + Math.sin(x / 130 + t / 1600 + k * 2) * 18);
      for (let x = W; x >= 0; x -= 24) b.lineTo(x, l.stageH * (0.3 + k * 0.07) + Math.sin(x / 110 + t / 1400 + k) * 22);
      b.close();
      c.drawPath(b.build(), gradientPaint(sk, 0, 0, 0, l.stageH * 0.55, [['#5FE3C0', '#9AD7FF', '#C8B6FF'][k]!, '#00000000'], 0.3));
    }
    if (S) for (const [x0, w2, hh, col] of [[-0.05, 0.4, 0.34, '#2C5A86'], [0.25, 0.5, 0.42, '#3A6C9C'], [0.62, 0.45, 0.3, '#2C5A86'], [0.8, 0.4, 0.38, '#3A6C9C']] as const) {
      const bx = W * x0, bw = W * w2, base = l.stageH * 0.64, top = base - l.stageH * hh;
      poly(sk, c, [bx, base, bx + bw / 2, top, bx + bw, base], paint(sk, col));
      poly(sk, c, [bx + bw / 2, top, bx + bw * 0.4, top + (base - top) * 0.28, bx + bw * 0.5, top + (base - top) * 0.22, bx + bw * 0.6, top + (base - top) * 0.3], paint(sk, '#EAF6FF'));
    }
    c.save(); floorClip(sk, c, l);
    if (S) c.drawRect(rect(0, fy - H * 0.2, W, H * 0.5), paint(sk, '#FFFFFF', 0.13));
    if (S) for (let i = 0; i < 30; i++) c.drawCircle(rnd(i + 200) * W, fy - H * 0.18 + rnd(i + 300) * H * 0.3, 1.5, paint(sk, '#FFFFFF', 0.27));
    c.restore();
  }
  c.restore();
}

/** Ambient particles in front of the backdrop: fireflies, bunting and balloons, rain, snow. */
export function drawDecor(sk: SkiaApi, c: Canvas, id: string, l: Layout, pal: StagePalette, t: number, beat: number) {
  'worklet';
  const { W, H } = l;
  if (id === 'pond') {
    for (let i = 0; i < 4; i++) {
      const x = W * (0.12 + i * 0.26), y = l.stageH * (0.88 + 0.03 * (i % 2));
      c.drawOval(rect(x - 30, y - 8, 60, 16), paint(sk, '#2C6F6A', 0.6));
      const k = (t / 40 + i * 20) % 30;
      c.drawOval(rect(x - 30 - k, y - 8 - k * 0.27, 60 + 2 * k, 16 + 0.54 * k), paint(sk, '#7FE3C4', 0.3, STROKE, 1.5));
    }
    const fly = freshPaint(sk, '#FFF8AA', 1);
    for (let i = 0; i < 14; i++) {
      const x = rnd(i + 40) * W + Math.sin(t / 1300 + i) * 18, y = l.stageH * (0.15 + rnd(i + 70) * 0.55) + Math.cos(t / 1700 + i) * 12;
      fly.setAlphaf(0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t / 400 + i * 2)));
      c.drawCircle(x, y, 2.2, fly);
    }
  } else if (id === 'fair') {
    const b = sk.PathBuilder.Make(); b.moveTo(0, 18); b.quadTo(W / 2, 70, W, 18);
    c.drawPath(b.build(), paint(sk, '#FFFFFF', 0.33, STROKE, 2));
    const cols = ['#FF7AA8', '#FFC857', '#5FE3C0', '#7A8CFF'];
    for (let i = 0; i < 14; i++) {
      const u = (i + 0.5) / 14, x = W * u, y = 18 + 52 * 4 * u * (1 - u) * 0.5 + 6;
      poly(sk, c, [x - 9, y, x + 9, y, x, y + 20 + 2 * Math.sin(t / 300 + i)], paint(sk, cols[i % 4]!, 0.8));
    }
    for (let i = 0; i < 5; i++) {
      const x = W * (0.08 + i * 0.21) + Math.sin(t / 1500 + i) * 10, y = l.stageH * (0.3 + 0.08 * Math.sin(t / 1100 + i * 2));
      c.drawLine(x, y + 18, x, y + 70, paint(sk, '#FFFFFF', 0.27, STROKE, 1.5));
      c.drawOval(rect(x - 13, y - 17, 26, 34), paint(sk, cols[(i + 1) % 4]!, 0.66));
    }
  } else if (id === 'clouds') {
    for (let i = 0; i < 5; i++) {
      const x = ((t / 40 + i * W * 0.25) % (W * 1.3)) - W * 0.15, y = l.stageH * (0.12 + ((0.12 * i) % 0.5));
      for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 28], [52, 0, 22], [26, 8, 24]] as const) c.drawCircle(x + dx, y + dy, r, paint(sk, '#D6F0FF', 0.13));
    }
  } else if (id === 'neon') {
    const rain = paint(sk, '#7DF9FF', 0.33, STROKE, 1.5);
    for (let i = 0; i < 46; i++) {
      const x = rnd(i + 400) * W, y = ((t / 3) * (0.6 + rnd(i + 500)) + rnd(i + 600) * l.stageH * 2) % (l.stageH * 1.2) - 10;
      c.drawLine(x, y, x - 3, y + 13, rain);
    }
  } else if (id === 'frost') {
    const snow = paint(sk, '#FFFFFF', 0.8);
    for (let i = 0; i < 70; i++) {
      const x = (rnd(i + 700) * W + Math.sin(t / 900 + i) * 14 + W) % W, y = ((t / 12) * (0.4 + rnd(i + 800)) + rnd(i + 900) * l.stageH * 2) % (l.stageH * 1.15) - 6;
      c.drawCircle(x, y, 1.2 + rnd(i + 1000) * 2, snow);
    }
  }
  // the floor rim breathes with the beat
  const fy = l.stageH * 0.93 + H * 0.055;
  const b = Math.max(0, 1 - (beat % 1) * 3);
  c.drawOval(rect(W / 2 - W * 0.55, fy - H * 0.25, W * 1.1, H * 0.5), paint(sk, pal.glow, (40 + 90 * b) / 255, STROKE, 3));
  void mix;
}

export interface TapEffect { x: number; y: number; t0: number; kind: 'ripple' | 'spark' | 'star' }

/** Tap-the-scenery toy: ripples (pond, neon), confetti sparks (fair), sparkling stars (clouds, frost). */
export function drawTaps(sk: SkiaApi, c: Canvas, taps: TapEffect[], t: number) {
  'worklet';
  for (const e of taps) {
    const age = (t - e.t0) / 1000;
    if (age < 0 || age > 1.3) continue;
    const fade = 1 - age / 1.3;
    if (e.kind === 'ripple') {
      for (let k = 0; k < 3; k++) { const a = age - k * 0.16; if (a < 0) continue; const r = 10 + 90 * a; c.drawOval(rect(e.x - r, e.y - r * 0.35, r * 2, r * 0.7), paint(sk, '#B4F0FF', 0.7 * (1 - a / 1.1 > 0 ? 1 - a / 1.1 : 0), STROKE, 2.5)); }
    } else {
      const n = e.kind === 'spark' ? 14 : 9;
      const cols = e.kind === 'spark' ? ['#FF7AA8', '#FFC857', '#5FE3C0', '#7A8CFF'] : ['#FFFFFF', '#D6F0FF', '#FFE8A3'];
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + rnd(i) * 0.6, sp = (e.kind === 'spark' ? 230 : 100) * (0.5 + rnd(i + 9));
        const x = e.x + Math.cos(ang) * sp * age, y = e.y + Math.sin(ang) * sp * age + (e.kind === 'spark' ? 200 * age * age : 0);
        c.drawCircle(x, y, (e.kind === 'spark' ? 4 : 3.5) * fade + 1, paint(sk, cols[i % cols.length]!, fade));
      }
    }
  }
}
