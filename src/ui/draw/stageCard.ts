import type { Stage } from '../../core/types';
import { IDLE_POSE, drawCreature } from './creature';
import { gradientPaint, mix, paint, STROKE, type Canvas, type SkiaApi } from './common';

/** Stage card art: the world's sky and floor with four creatures peeking up from the bottom edge. */
export function drawStageCard(sk: SkiaApi, c: Canvas, stage: Stage, w: number, h: number, locked: boolean) {
  'worklet';
  const pal = stage.palette;
  c.save();
  c.clipRRect(sk.RRectXY(sk.XYWHRect(0, 0, w, h), 22, 22), 1, true);
  c.drawRect(sk.XYWHRect(0, 0, w, h), gradientPaint(sk, 0, 0, 0, h, [mix(pal.sky, '#0B0722', 0.4), pal.sky, mix(pal.sky, pal.floor, 0.6)]));
  for (let i = 0; i < 14; i++) {
    const a = Math.sin(i * 12.9898 + 1.7) * 43758.5453, b = Math.sin(i * 78.233 + 3.1) * 24634.6345;
    c.drawCircle((a - Math.floor(a)) * w, (b - Math.floor(b)) * h * 0.5, 1.4, paint(sk, '#FFFFFF', 0.6));
  }
  c.drawOval(sk.XYWHRect(-w * 0.1, h * 0.62, w * 1.2, h * 0.7), gradientPaint(sk, 0, h * 0.62, 0, h, [mix(pal.floor, '#FFFFFF', 0.15), pal.floor]));
  const S = w * 0.3;
  const picks = [0, 5, 10, 15].map((i) => stage.creatures[i]!);
  picks.forEach((cr, i) => {
    const x = w * (0.17 + i * 0.22);
    drawCreature(sk, c, cr, x, h * (0.86 + (i % 2) * 0.05), S, locked ? { ...IDLE_POSE, sat: 0.35, alpha: 0.7 } : { ...IDLE_POSE, mouth: i % 2 ? 0.3 : 0 });
  });
  c.restore();
  c.drawRRect(sk.RRectXY(sk.XYWHRect(1.5, 1.5, w - 3, h - 3), 22, 22), paint(sk, pal.glow, 0.45, STROKE, 3));
}
