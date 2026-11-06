import type { BodyShape, Creature } from '../../core/types';
import { CAP_ROUND, FILL, STROKE, gradientPaint, mix, paint, radialPaint, saturationLayerPaint, type Canvas, type SkiaApi } from './common';

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
}
export const IDLE_POSE: Pose = { sx: 1, sy: 1, lift: 0, tilt: 0, mouth: 0, eyes: 1, muted: false, sat: 1, alpha: 1, glow: 0, arms: 0 };

const DIM: Record<BodyShape, { w: number; h: number }> = {
  round: { w: 0.9, h: 0.86 },
  wide: { w: 1.18, h: 0.66 },
  tall: { w: 0.6, h: 1.2 },
  small: { w: 0.7, h: 0.7 },
};

/** Body size (in units of S) for hit-testing and layout. */
export function bodyDims(shape: BodyShape): { w: number; h: number } {
  'worklet';
  return DIM[shape];
}

function ellipse(sk: SkiaApi, cx: number, cy: number, rx: number, ry: number) {
  'worklet';
  return sk.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2);
}

function drawEars(sk: SkiaApi, c: Canvas, cr: Creature, S: number, w: number, h: number, color: string, dark: string, wiggle: number) {
  'worklet';
  const top = -h * S;
  const earCol = mix(color, '#FFFFFF', 0.1);
  switch (cr.shape.ears) {
    case 'round':
      for (const d of [-1, 1]) {
        c.drawCircle(d * w * S * 0.3, top + h * S * 0.12, S * 0.12, paint(sk, earCol));
        c.drawCircle(d * w * S * 0.3, top + h * S * 0.12, S * 0.065, paint(sk, dark, 0.35));
      }
      break;
    case 'pointy':
      for (const d of [-1, 1]) {
        const p = sk.PathBuilder.Make();
        p.moveTo(d * w * S * 0.12, top + h * S * 0.14);
        p.lineTo(d * w * S * 0.34, top - S * 0.13 + wiggle * S * 0.02);
        p.lineTo(d * w * S * 0.46, top + h * S * 0.22);
        p.close();
        c.drawPath(p.build(), paint(sk, earCol));
      }
      break;
    case 'floppy':
      for (const d of [-1, 1]) {
        c.save();
        c.rotate(d * (24 + wiggle * 6), d * w * S * 0.38, top + h * S * 0.2);
        c.drawOval(ellipse(sk, d * w * S * 0.42, top + h * S * 0.3, S * 0.09, S * 0.17), paint(sk, earCol));
        c.restore();
      }
      break;
    case 'antenna':
      for (const d of [-1, 1]) {
        const x = d * w * S * 0.18;
        const tipX = x + d * S * 0.1 + wiggle * S * 0.03;
        c.drawLine(x, top + h * S * 0.1, tipX, top - S * 0.2, paint(sk, dark, 0.7, STROKE, S * 0.025));
        c.drawCircle(tipX, top - S * 0.22, S * 0.05, paint(sk, '#FFFFFF', 0.9));
        c.drawCircle(tipX, top - S * 0.22, S * 0.05, paint(sk, color, 0.55));
      }
      break;
    default:
  }
}

function drawAccessory(sk: SkiaApi, c: Canvas, cr: Creature, S: number, w: number, h: number, color: string) {
  'worklet';
  const top = -h * S;
  switch (cr.shape.accessory) {
    case 'bow': {
      const x = w * S * 0.26, y = top + h * S * 0.1;
      for (const d of [-1, 1]) {
        const p = sk.PathBuilder.Make();
        p.moveTo(x, y); p.lineTo(x + d * S * 0.17, y - S * 0.1); p.lineTo(x + d * S * 0.17, y + S * 0.1); p.close();
        c.drawPath(p.build(), paint(sk, '#FF5C8A'));
      }
      c.drawCircle(x, y, S * 0.045, paint(sk, '#FF92B1'));
      break;
    }
    case 'hat': {
      const p = sk.PathBuilder.Make();
      p.moveTo(-S * 0.14, top + S * 0.04); p.lineTo(0, top - S * 0.3); p.lineTo(S * 0.14, top + S * 0.04); p.close();
      c.drawPath(p.build(), paint(sk, '#FFD36B'));
      c.drawCircle(0, top - S * 0.3, S * 0.04, paint(sk, '#FF7AA8'));
      c.drawOval(ellipse(sk, 0, top + S * 0.04, S * 0.16, S * 0.035), paint(sk, '#FFB547'));
      break;
    }
    case 'crown': {
      const p = sk.PathBuilder.Make();
      const y = top + S * 0.03;
      p.moveTo(-S * 0.17, y); p.lineTo(-S * 0.19, y - S * 0.17); p.lineTo(-S * 0.09, y - S * 0.09);
      p.lineTo(0, y - S * 0.2); p.lineTo(S * 0.09, y - S * 0.09); p.lineTo(S * 0.19, y - S * 0.17); p.lineTo(S * 0.17, y); p.close();
      c.drawPath(p.build(), paint(sk, '#FFD24A'));
      c.drawCircle(0, y - S * 0.07, S * 0.025, paint(sk, '#FF7AA8'));
      break;
    }
    case 'flower': {
      const x = -w * S * 0.27, y = top + h * S * 0.12;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        c.drawCircle(x + Math.cos(a) * S * 0.055, y + Math.sin(a) * S * 0.055, S * 0.045, paint(sk, '#FFFFFF', 0.95));
      }
      c.drawCircle(x, y, S * 0.035, paint(sk, '#FFC857'));
      break;
    }
    case 'glasses': {
      const y = top + h * S * 0.38, dx = w * S * 0.2;
      for (const d of [-1, 1]) c.drawCircle(d * dx, y, S * 0.095, paint(sk, '#FFFFFF', 0.85, STROKE, S * 0.018));
      c.drawLine(-dx + S * 0.095, y, dx - S * 0.095, y, paint(sk, '#FFFFFF', 0.85, STROKE, S * 0.018));
      break;
    }
    case 'scarf': {
      const y = -h * S * 0.2;
      c.drawRRect(sk.RRectXY(sk.XYWHRect(-w * S * 0.36, y, w * S * 0.72, S * 0.085), S * 0.04, S * 0.04), paint(sk, mix(color, '#FFFFFF', 0.55), 0.95));
      c.drawRRect(sk.RRectXY(sk.XYWHRect(w * S * 0.12, y, S * 0.07, S * 0.2), S * 0.03, S * 0.03), paint(sk, mix(color, '#FFFFFF', 0.45), 0.95));
      break;
    }
    case 'star': {
      const x = 0, y = top + S * 0.02, r = S * 0.1;
      const p = sk.PathBuilder.Make();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        const px = x + Math.cos(a) * rr, py = y - r * 0.4 + Math.sin(a) * rr;
        if (i === 0) p.moveTo(px, py); else p.lineTo(px, py);
      }
      p.close();
      c.drawPath(p.build(), paint(sk, '#FFE066'));
      break;
    }
    default:
  }
}

function drawEyes(sk: SkiaApi, c: Canvas, cr: Creature, S: number, w: number, h: number, open: number, closed: boolean, dark: string) {
  'worklet';
  const y = -h * S * 0.6;
  const dx = w * S * 0.2;
  const style = cr.shape.eyes;
  for (const d of [-1, 1]) {
    const x = d * dx;
    if (closed || open < 0.12) {
      // closed eye: a happy/sleeping arc
      const r = S * 0.065;
      c.drawArc(ellipse(sk, x, y, r, r * 0.7), 20, 140, false, paint(sk, dark, 1, STROKE, S * 0.026));
      continue;
    }
    if (style === 'dots') {
      c.drawOval(ellipse(sk, x, y, S * 0.04, S * 0.055 * open), paint(sk, dark));
      c.drawCircle(x - S * 0.012, y - S * 0.02 * open, S * 0.014, paint(sk, '#FFFFFF'));
    } else if (style === 'big') {
      c.drawOval(ellipse(sk, x, y, S * 0.075, S * 0.09 * open), paint(sk, '#FFFFFF'));
      c.drawOval(ellipse(sk, x + d * S * 0.008, y + S * 0.01, S * 0.045, S * 0.055 * open), paint(sk, dark));
      c.drawCircle(x - S * 0.012, y - S * 0.015 * open, S * 0.014, paint(sk, '#FFFFFF'));
    } else if (style === 'sleepy') {
      c.drawOval(ellipse(sk, x, y, S * 0.05, S * 0.055 * open), paint(sk, dark));
      c.drawRect(sk.XYWHRect(x - S * 0.06, y - S * 0.07, S * 0.12, S * 0.07 * (1.05 - 0.5 * open)), paint(sk, mix(cr.color, '#FFFFFF', 0.12)));
      c.drawLine(x - S * 0.055, y - S * 0.012, x + S * 0.055, y - S * 0.012, paint(sk, dark, 0.9, STROKE, S * 0.014));
    } else {
      c.drawOval(ellipse(sk, x, y, S * 0.065, S * 0.08 * open), paint(sk, dark));
      c.drawCircle(x - S * 0.02, y - S * 0.025 * open, S * 0.02, paint(sk, '#FFFFFF'));
      c.drawCircle(x + S * 0.02, y + S * 0.02 * open, S * 0.01, paint(sk, '#FFFFFF', 0.85));
    }
  }
}

/**
 * Draws one gummy creature standing with its feet at (x, y). S is the body box size in px.
 * Everything is original vector art built from ovals and paths.
 */
export function drawCreature(sk: SkiaApi, c: Canvas, cr: Creature, x: number, y: number, S: number, pose: Pose) {
  'worklet';
  const { w, h } = DIM[cr.shape.body];
  const color = cr.color;
  const dark = mix(color, '#1B1340', 0.8);
  const light = mix(color, '#FFFFFF', 0.45);
  const deep = mix(color, '#1B1340', 0.28);
  const alpha = pose.alpha * (pose.muted ? 0.4 : 1);

  // shadow stays on the floor (not lifted)
  c.drawOval(ellipse(sk, x, y + S * 0.02, w * S * 0.46 * (1 - pose.lift / (S * 3)), S * 0.06), paint(sk, '#0A0620', 0.35 * pose.alpha));

  const needsLayer = pose.muted || pose.sat < 0.999 || alpha < 0.999;
  if (needsLayer) c.saveLayer(saturationLayerPaint(sk, pose.muted ? 0.15 : pose.sat, alpha));
  c.save();
  c.translate(x, y - pose.lift);
  c.rotate((pose.tilt * 180) / Math.PI, 0, 0);
  c.scale(pose.sx, pose.sy);

  if (pose.glow > 0.01) {
    c.drawCircle(0, -h * S * 0.5, S * 0.85, radialPaint(sk, 0, -h * S * 0.5, S * 0.85, ['#FFFFFF', color, '#00000000'], 0.45 * pose.glow));
  }

  drawEars(sk, c, cr, S, w, h, color, dark, pose.arms);

  // feet
  for (const d of [-1, 1]) c.drawOval(ellipse(sk, d * w * S * 0.22, -S * 0.02, S * 0.085, S * 0.05), paint(sk, deep));
  // arms swing with the onsets
  for (const d of [-1, 1]) {
    c.save();
    c.rotate(d * (18 + pose.arms * 28), d * w * S * 0.46, -h * S * 0.42);
    c.drawOval(ellipse(sk, d * (w * S * 0.5 + S * 0.03), -h * S * 0.36, S * 0.06, S * 0.09), paint(sk, color));
    c.restore();
  }

  // body: gummy gradient + translucent rim + gloss
  const bodyRect = ellipse(sk, 0, -h * S * 0.5 - S * 0.02, (w * S) / 2, (h * S) / 2);
  const bodyR = cr.shape.body === 'tall' ? (w * S) / 2 : 0;
  const drawBody = (p: ReturnType<typeof paint>) => {
    if (bodyR > 0) c.drawRRect(sk.RRectXY(sk.XYWHRect(-(w * S) / 2, -h * S - S * 0.02, w * S, h * S), bodyR, bodyR * 1.1), p);
    else c.drawOval(bodyRect, p);
  };
  drawBody(gradientPaint(sk, 0, -h * S, 0, 0, [light, color, deep]));
  // inner edge glow (rim light from below) for a translucent look
  drawBody(paint(sk, mix(color, '#FFFFFF', 0.7), 0.5, STROKE, S * 0.022));
  c.save();
  c.translate(-w * S * 0.2, -h * S * 0.8);
  c.rotate(-28, 0, 0);
  c.drawOval(ellipse(sk, 0, 0, w * S * 0.17, h * S * 0.085), paint(sk, '#FFFFFF', 0.6));
  c.restore();
  c.drawCircle(-w * S * 0.3, -h * S * 0.6, S * 0.018, paint(sk, '#FFFFFF', 0.7));
  // soft bottom bounce light
  c.drawOval(ellipse(sk, w * S * 0.12, -h * S * 0.12, w * S * 0.25, h * S * 0.05), paint(sk, '#FFFFFF', 0.16));

  drawEyes(sk, c, cr, S, w, h, pose.eyes, pose.muted, dark);

  // cheeks
  for (const d of [-1, 1]) c.drawOval(ellipse(sk, d * w * S * 0.32, -h * S * 0.45, S * 0.04, S * 0.025), paint(sk, '#FF7AA8', 0.28));

  // mouth: a small smile at rest, opens with the music (voice creatures have a big mouth)
  const big = cr.layer === 'voice';
  const my = -h * S * (big ? 0.32 : 0.36);
  const open = pose.muted ? 0 : pose.mouth;
  if (open < 0.08) {
    c.drawArc(ellipse(sk, 0, my - S * 0.02, S * (big ? 0.1 : 0.06), S * 0.045), 15, 150, false, paint(sk, dark, 1, STROKE, S * 0.022));
  } else {
    const mw = S * (big ? 0.15 : 0.085) * (0.8 + 0.2 * open);
    const mh = S * (big ? 0.16 : 0.09) * open;
    c.drawOval(ellipse(sk, 0, my + mh * 0.2, mw, mh), paint(sk, mix(dark, '#000000', 0.2)));
    c.drawOval(ellipse(sk, 0, my + mh * 0.55, mw * 0.65, mh * 0.45), paint(sk, '#FF6F91', 0.9));
  }

  drawAccessory(sk, c, cr, S, w, h, color);
  c.restore();
  if (needsLayer) c.restore();
  void CAP_ROUND; void FILL;
}
