import type { Combo, Stage } from '../../core/types';
import { IDLE_POSE, drawCreature } from './creature';
import { gradientPaint, mix, paint, STROKE, type Canvas, type SkiaApi, rect } from './common';

/** One combo card: the 4 creatures side by side. Undiscovered = dark silhouettes; discovered = full colour. */
export function drawComboCard(sk: SkiaApi, c: Canvas, stage: Stage, combo: Combo, w: number, h: number, discovered: boolean, have: readonly string[] = []) {
  'worklet';
  c.drawRRect(sk.RRectXY(rect(0, 0, w, h), 18, 18), gradientPaint(sk, 0, 0, 0, h, [mix(stage.palette.sky, '#FFFFFF', 0.12), stage.palette.floor]));
  c.drawRRect(sk.RRectXY(rect(1, 1, w - 2, h - 2), 18, 18), paint(sk, stage.palette.glow, discovered ? 0.6 : 0.2, STROKE, 2));
  const S = Math.min(h * 0.62, w / 4.6);
  combo.creatureIds.forEach((id, i) => {
    const cr = stage.creatures.find((q) => q.id === id)!;
    const x = w * (0.14 + i * 0.24);
    // a singer that is on stage right now already shows in colour (an honest "you have this one"); the others stay silhouettes
    const there = discovered || have.includes(id);
    drawCreature(sk, c, cr, x, h * 0.78, S, there ? { ...IDLE_POSE, mouth: discovered ? 0.3 : 0 } : { ...IDLE_POSE, sat: 0, alpha: 0.35 });
  });
  if (!discovered) {
    // question mark made of shapes: no text needed
    c.drawCircle(w / 2, h * 0.5, 5, paint(sk, '#FFFFFF', 0.8));
  }
}
