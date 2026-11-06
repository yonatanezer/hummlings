import type { BodyShape, Creature } from '../../core/types';
import { STROKE, gradientPaint, mix, paint, radialPaint, saturationLayerPaint, type Canvas, type SkiaApi } from './common';

/** Everything that changes from frame to frame for one creature. */
export interface Pose {
  sx: number; // squash/stretch about the feet
  sy: number;
  lift: number; // px above the floor (hop / carried)
  tilt: number; // radians
  mouth: number; // 0..1 openness
  eyes: number; // 0 closed .. 1 open (blink)
  muted: boolean; // eyes closed + desaturated + 40% opacity
  sat: number; // 1 normal, 0 grey (tray silhouettes)
  alpha: number; // extra opacity (solo dimming)
  glow: number; // 0..1 spotlight / celebration glow
  arms: number; // -1..1 swing
  time: number; // ms, drives ear/tail/gill wiggle and eye glances (0 = still)
}
export const IDLE_POSE: Pose = { sx: 1, sy: 1, lift: 0, tilt: 0, mouth: 0, eyes: 1, muted: false, sat: 1, alpha: 1, glow: 0, arms: 0, time: 0 };

const DIM: Record<BodyShape, { w: number; h: number }> = {
  round: { w: 0.92, h: 0.84 },
  wide: { w: 1.12, h: 0.7 },
  tall: { w: 0.64, h: 1.1 },
  small: { w: 0.74, h: 0.74 },
};

/** Body size (in units of S) for hit-testing and layout. */
export function bodyDims(shape: BodyShape): { w: number; h: number } {
  'worklet';
  return DIM[shape];
}

function oval(sk: SkiaApi, cx: number, cy: number, rx: number, ry: number) {
  'worklet';
  return sk.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2);
}

function tri(sk: SkiaApi, c: Canvas, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, p: ReturnType<typeof paint>) {
  'worklet';
  const b = sk.PathBuilder.Make();
  b.moveTo(x1, y1); b.lineTo(x2, y2); b.lineTo(x3, y3); b.close();
  c.drawPath(b.build(), p);
}

/** Parts drawn BEHIND the body: ears, spikes, frills, tail. */
function drawBack(sk: SkiaApi, c: Canvas, cr: Creature, S: number, w: number, h: number, color: string, wig: number) {
  'worklet';
  const top = -h * S - S * 0.02;
  const hw = (w * S) / 2;
  const light = mix(color, '#FFFFFF', 0.25);
  const inner = '#FF9DBB';
  switch (cr.shape.species) {
    case 'cat':
      for (const d of [-1, 1]) {
        c.save();
        c.rotate(d * wig * 6, d * hw * 0.5, top + S * 0.08);
        tri(sk, c, d * hw * 0.25, top + S * 0.06, d * hw * 0.95, top + S * 0.1, d * hw * 0.78, top - S * 0.17 + wig * S * 0.01, paint(sk, light));
        tri(sk, c, d * hw * 0.42, top + S * 0.07, d * hw * 0.8, top + S * 0.09, d * hw * 0.72, top - S * 0.08, paint(sk, inner, 0.85));
        c.restore();
      }
      break;
    case 'bunny':
      for (const d of [-1, 1]) {
        c.save();
        c.rotate(d * (9 + wig * 9), d * hw * 0.4, top + S * 0.1);
        c.drawOval(oval(sk, d * hw * 0.42, top - S * 0.12, S * 0.075, S * 0.21), paint(sk, light));
        c.drawOval(oval(sk, d * hw * 0.42, top - S * 0.1, S * 0.036, S * 0.15), paint(sk, inner, 0.85));
        c.restore();
      }
      break;
    case 'bear':
      for (const d of [-1, 1]) {
        c.drawCircle(d * hw * 0.74, top + S * 0.1, S * 0.12, paint(sk, light));
        c.drawCircle(d * hw * 0.74, top + S * 0.11, S * 0.06, paint(sk, mix(color, '#5A2A3A', 0.45), 0.7));
      }
      break;
    case 'mouse':
      for (const d of [-1, 1]) {
        c.drawCircle(d * hw * 0.7, top + S * 0.06, S * 0.16, paint(sk, light));
        c.drawCircle(d * hw * 0.7, top + S * 0.07, S * 0.1, paint(sk, inner, 0.85));
      }
      break;
    case 'frog':
      for (const d of [-1, 1]) c.drawCircle(d * hw * 0.5, top + S * 0.03, S * 0.1, paint(sk, light));
      break;
    case 'bird':
      for (let i = -1; i <= 1; i++) c.drawOval(oval(sk, i * S * 0.045 + wig * S * 0.012, top - S * 0.04 - (i === 0 ? S * 0.03 : 0), S * 0.03, S * 0.075), paint(sk, light));
      break;
    case 'dino':
      for (let i = -1; i <= 1; i++) tri(sk, c, i * S * 0.12 - S * 0.06, top + S * 0.05, i * S * 0.12, top - S * 0.1 - (i === 0 ? S * 0.04 : 0), i * S * 0.12 + S * 0.06, top + S * 0.05, paint(sk, mix(color, '#FFFFFF', 0.4)));
      tri(sk, c, hw * 0.8, -S * 0.1, hw * 1.25, -S * 0.2 + wig * S * 0.06, hw * 0.85, -S * 0.3, paint(sk, color));
      break;
    default: // axolotl: feathery gills
      for (const d of [-1, 1]) for (let i = 0; i < 3; i++) {
        c.save();
        c.rotate(d * (28 + i * 22 + wig * 9), d * hw * 0.85, -h * S * 0.62);
        c.drawOval(oval(sk, d * (hw * 0.95 + S * 0.08), -h * S * 0.62, S * 0.1, S * 0.03), paint(sk, inner, 0.9));
        c.restore();
      }
  }
}

function drawFace(sk: SkiaApi, c: Canvas, cr: Creature, S: number, w: number, h: number, pose: Pose, dark: string) {
  'worklet';
  const ey = -h * S * 0.5;
  const dx = w * S * 0.22;
  const style = cr.shape.eyes;
  const closed = pose.muted || pose.eyes < 0.12;
  const look = Math.sin(pose.time / 1300) * S * 0.014;
  const rx = S * (style === 'big' ? 0.068 : 0.055);
  const ry = S * (style === 'big' ? 0.088 : 0.072) * pose.eyes;
  for (const d of [-1, 1]) {
    const x = d * dx;
    if (closed || style === 'sleepy') {
      c.drawArc(oval(sk, x, ey + S * 0.01, S * 0.06, S * 0.05), 200, 140, false, paint(sk, dark, 1, STROKE, S * 0.026));
      continue;
    }
    const px = x + look;
    c.drawOval(oval(sk, px, ey, rx, ry), paint(sk, dark));
    c.drawCircle(px - rx * 0.3, ey - ry * 0.35, rx * 0.4, paint(sk, '#FFFFFF'));
    c.drawCircle(px + rx * 0.35, ey + ry * 0.4, rx * 0.2, paint(sk, '#FFFFFF', 0.85));
    if (style === 'sparkle') {
      const sx = px + rx * 0.5, sy = ey - ry * 0.55;
      c.drawLine(sx - S * 0.02, sy, sx + S * 0.02, sy, paint(sk, '#FFFFFF', 0.95, STROKE, S * 0.008));
      c.drawLine(sx, sy - S * 0.02, sx, sy + S * 0.02, paint(sk, '#FFFFFF', 0.95, STROKE, S * 0.008));
    }
  }
  // blush
  for (const d of [-1, 1]) c.drawOval(oval(sk, d * (dx + S * 0.1), ey + S * 0.07, S * 0.05, S * 0.03), paint(sk, '#FF6F91', 0.35));

  const sp = cr.shape.species;
  const my = ey + S * 0.13;
  const open = pose.muted ? 0 : pose.mouth;
  const big = cr.layer === 'voice';
  // muzzle / nose per species
  if (sp === 'bear') c.drawOval(oval(sk, 0, my - S * 0.01, S * 0.11, S * 0.08), paint(sk, mix(cr.color, '#FFFFFF', 0.6), 0.8));
  if (sp === 'bear' || sp === 'mouse' || sp === 'cat' || sp === 'bunny') c.drawOval(oval(sk, 0, my - S * 0.05, S * 0.025, S * 0.018), paint(sk, sp === 'bear' ? dark : '#FF7FA3'));
  if (sp === 'cat' || sp === 'mouse') {
    for (const d of [-1, 1]) for (let i = 0; i < 2; i++) c.drawLine(d * S * 0.1, my - S * 0.03 + i * S * 0.03, d * S * 0.22, my - S * 0.05 + i * S * 0.06, paint(sk, dark, 0.45, STROKE, S * 0.01));
  }
  if (sp === 'dino') for (const d of [-1, 1]) c.drawCircle(d * S * 0.03, my - S * 0.05, S * 0.009, paint(sk, dark, 0.6));
  if (sp === 'bird') tri(sk, c, -S * 0.045, my - S * 0.06, S * 0.045, my - S * 0.06, 0, my + S * 0.02 + open * S * 0.02, paint(sk, '#FFA94D'));
  else if (open < 0.08) {
    c.drawArc(oval(sk, -S * 0.03, my - S * 0.03, S * 0.035, S * 0.03), 20, 140, false, paint(sk, dark, 1, STROKE, S * 0.016));
    c.drawArc(oval(sk, S * 0.03, my - S * 0.03, S * 0.035, S * 0.03), 20, 140, false, paint(sk, dark, 1, STROKE, S * 0.016));
  } else {
    const mw = S * (big ? 0.1 : 0.06) * (0.8 + 0.2 * open);
    const mh = S * (big ? 0.11 : 0.07) * open;
    c.drawOval(oval(sk, 0, my + mh * 0.2, mw, mh), paint(sk, mix(dark, '#000000', 0.2)));
    c.drawOval(oval(sk, 0, my + mh * 0.6, mw * 0.65, mh * 0.45), paint(sk, '#FF6F91', 0.9));
  }
}

function drawAccessory(sk: SkiaApi, c: Canvas, cr: Creature, S: number, w: number, h: number, color: string) {
  'worklet';
  const top = -h * S - S * 0.02;
  const hw = (w * S) / 2;
  switch (cr.shape.accessory) {
    case 'bow': {
      const x = hw * 0.5, y = top + S * 0.1;
      for (const d of [-1, 1]) tri(sk, c, x, y, x + d * S * 0.15, y - S * 0.09, x + d * S * 0.15, y + S * 0.09, paint(sk, '#FF5C8A'));
      c.drawCircle(x, y, S * 0.04, paint(sk, '#FF92B1'));
      break;
    }
    case 'hat':
      tri(sk, c, -S * 0.13, top + S * 0.05, 0, top - S * 0.26, S * 0.13, top + S * 0.05, paint(sk, '#FFD36B'));
      c.drawCircle(0, top - S * 0.26, S * 0.04, paint(sk, '#FF7AA8'));
      break;
    case 'crown': {
      const y = top + S * 0.05;
      const b = sk.PathBuilder.Make();
      b.moveTo(-S * 0.15, y); b.lineTo(-S * 0.17, y - S * 0.15); b.lineTo(-S * 0.08, y - S * 0.08); b.lineTo(0, y - S * 0.18);
      b.lineTo(S * 0.08, y - S * 0.08); b.lineTo(S * 0.17, y - S * 0.15); b.lineTo(S * 0.15, y); b.close();
      c.drawPath(b.build(), paint(sk, '#FFD24A'));
      c.drawCircle(0, y - S * 0.06, S * 0.022, paint(sk, '#FF7AA8'));
      break;
    }
    case 'flower': {
      const x = -hw * 0.5, y = top + S * 0.1;
      for (let i = 0; i < 5; i++) c.drawCircle(x + Math.cos((i / 5) * 6.283) * S * 0.05, y + Math.sin((i / 5) * 6.283) * S * 0.05, S * 0.042, paint(sk, '#FFFFFF', 0.95));
      c.drawCircle(x, y, S * 0.032, paint(sk, '#FFC857'));
      break;
    }
    case 'scarf': {
      const y = -h * S * 0.2;
      c.drawRRect(sk.RRectXY(sk.XYWHRect(-hw * 0.72, y, hw * 1.44, S * 0.08), S * 0.04, S * 0.04), paint(sk, mix(color, '#FFFFFF', 0.55), 0.95));
      c.drawRRect(sk.RRectXY(sk.XYWHRect(hw * 0.25, y, S * 0.065, S * 0.17), S * 0.03, S * 0.03), paint(sk, mix(color, '#FFFFFF', 0.45), 0.95));
      break;
    }
    case 'star': {
      const r = S * 0.09, y = top - S * 0.02;
      const b = sk.PathBuilder.Make();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        if (i === 0) b.moveTo(Math.cos(a) * rr, y + Math.sin(a) * rr); else b.lineTo(Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      b.close();
      c.drawPath(b.build(), paint(sk, '#FFE066'));
      break;
    }
    default:
  }
}

/** Draws one gummy creature standing with its feet at (x, y). S is the body box size in px. Original vector art. */
export function drawCreature(sk: SkiaApi, c: Canvas, cr: Creature, x: number, y: number, S: number, pose: Pose) {
  'worklet';
  const { w, h } = DIM[cr.shape.body];
  const color = cr.color;
  const dark = mix(color, '#2A1233', 0.82);
  const light = mix(color, '#FFFFFF', 0.5);
  const deep = mix(color, '#2A1F5C', 0.32);
  const alpha = pose.alpha * (pose.muted ? 0.4 : 1);

  c.drawOval(oval(sk, x, y + S * 0.02, w * S * 0.46 * (1 - pose.lift / (S * 3)), S * 0.055), paint(sk, '#0A0620', 0.35 * pose.alpha));
  const needsLayer = pose.muted || pose.sat < 0.999 || alpha < 0.999;
  if (needsLayer) c.saveLayer(saturationLayerPaint(sk, pose.muted ? 0.15 : pose.sat, alpha));
  c.save();
  c.translate(x, y - pose.lift);
  c.rotate((pose.tilt * 180) / Math.PI, 0, 0);
  c.scale(pose.sx, pose.sy);

  if (pose.glow > 0.01) c.drawCircle(0, -h * S * 0.5, S * 0.85, radialPaint(sk, 0, -h * S * 0.5, S * 0.85, ['#FFFFFF', color, '#00000000'], 0.45 * pose.glow));

  const wave = pose.time > 0 ? Math.sin(pose.time / 170) : 0; // ears, tail, gills sway continuously
  drawBack(sk, c, cr, S, w, h, color, pose.arms * 0.7 + wave);
  for (const d of [-1, 1]) c.drawOval(oval(sk, d * w * S * 0.22, -S * 0.025, S * 0.085, S * 0.05), paint(sk, deep));
  const armSwing = pose.arms;
  for (const d of [-1, 1]) {
    c.save();
    c.rotate(d * (22 + armSwing * 26), d * w * S * 0.46, -h * S * 0.4);
    c.drawOval(oval(sk, d * (w * S * 0.48 + S * 0.025), -h * S * 0.34, S * 0.055, S * 0.085), paint(sk, deep));
    c.restore();
  }

  const body = oval(sk, 0, -h * S * 0.5 - S * 0.02, (w * S) / 2, (h * S) / 2);
  const bodyR = cr.shape.body === 'tall' ? (w * S) / 2 : 0;
  const drawBody = (p: ReturnType<typeof paint>) => {
    if (bodyR > 0) c.drawRRect(sk.RRectXY(sk.XYWHRect(-(w * S) / 2, -h * S - S * 0.02, w * S, h * S), bodyR, bodyR * 1.15), p);
    else c.drawOval(body, p);
  };
  drawBody(gradientPaint(sk, 0, -h * S, 0, 0, [mix(color, '#FFFFFF', 0.3), color, deep]));
  c.drawOval(oval(sk, 0, -h * S * 0.26, w * S * 0.3, h * S * 0.2), paint(sk, light, 0.4)); // light belly
  drawBody(paint(sk, mix(color, '#FFFFFF', 0.7), 0.45, STROKE, S * 0.02));
  c.save();
  c.translate(-w * S * 0.22, -h * S * 0.86);
  c.rotate(-28, 0, 0);
  c.drawOval(oval(sk, 0, 0, w * S * 0.16, h * S * 0.07), paint(sk, '#FFFFFF', 0.6));
  c.restore();
  c.drawCircle(-w * S * 0.36, -h * S * 0.68, S * 0.016, paint(sk, '#FFFFFF', 0.7));

  drawFace(sk, c, cr, S, w, h, pose, dark);
  drawAccessory(sk, c, cr, S, w, h, color);
  c.restore();
  if (needsLayer) c.restore();
}
