import type { Creature } from '../../core/types';
import { IDLE_POSE, drawCreature } from './creature';
import { gradientPaint, type Canvas, type SkiaApi } from './common';

/** Splash: eight creatures in a row, bouncing in a wave. Wordmark is drawn as text by the screen. */
export function drawSplash(sk: SkiaApi, c: Canvas, creatures: Creature[], w: number, h: number, timeMs: number) {
  'worklet';
  c.drawRect(sk.XYWHRect(0, 0, w, h), gradientPaint(sk, 0, 0, 0, h, ['#0B0722', '#1B1340', '#2A1F5C']));
  const S = Math.min(h * 0.34, w / 9);
  creatures.slice(0, 8).forEach((cr, i) => {
    const k = Math.sin(timeMs / 220 - i * 0.7);
    const rise = Math.max(0, k) * S * 0.25;
    const grow = Math.min(1, Math.max(0, (timeMs - i * 70) / 350)); // pop in one after another
    drawCreature(sk, c, cr, w * (0.1 + i * 0.115), h * 0.7 - rise * grow, S * grow, { ...IDLE_POSE, mouth: Math.max(0, k) * 0.6, sy: 1 + 0.05 * k });
  });
}
