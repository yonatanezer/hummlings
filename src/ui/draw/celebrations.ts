import type { Layout } from '../../core/layout';
import type { StagePalette } from '../../core/types';
import { TUNING } from '../../core/tuning';
import { gradientPaint, mix, paint, type Canvas, type SkiaApi } from './common';

type Dance = 'wave' | 'spin' | 'jump' | 'conga';
interface Spec { dance: Dance; blocks: ('beams' | 'confetti' | 'stars' | 'bubbles' | 'rings' | 'lanterns')[]; colors: string[] }

const SPECS: Record<string, Spec> = {
  cel_pond_1: { dance: 'wave', blocks: ['beams', 'bubbles'], colors: ['#7A8CFF', '#5FE3C0', '#FFE8A3'] },
  cel_pond_2: { dance: 'jump', blocks: ['stars', 'confetti'], colors: ['#FFE8A3', '#FF7AA8', '#5FE3C0'] },
  cel_pond_3: { dance: 'spin', blocks: ['rings', 'lanterns'], colors: ['#C8B6FF', '#7A8CFF', '#FFFFFF'] },
  cel_fair_1: { dance: 'jump', blocks: ['confetti', 'beams'], colors: ['#FF7AA8', '#FFC857', '#5FE3C0', '#7A8CFF'] },
  cel_fair_2: { dance: 'conga', blocks: ['stars', 'lanterns'], colors: ['#FFD6E8', '#FF7AA8', '#FFC857'] },
  cel_fair_3: { dance: 'spin', blocks: ['rings', 'confetti'], colors: ['#FFC857', '#FF7AA8', '#FFFFFF'] },
  cel_clouds_1: { dance: 'wave', blocks: ['bubbles', 'stars'], colors: ['#D6F0FF', '#5FE3C0', '#FFFFFF'] },
  cel_clouds_2: { dance: 'conga', blocks: ['beams', 'lanterns'], colors: ['#FFE8A3', '#D6F0FF', '#7A8CFF'] },
  cel_pond_4: { dance: 'conga', blocks: ['beams', 'stars', 'confetti'], colors: ['#7A8CFF', '#FFE8A3', '#FF7AA8'] },
  cel_fair_4: { dance: 'wave', blocks: ['rings', 'bubbles', 'lanterns'], colors: ['#FFD6E8', '#FFC857', '#5FE3C0'] },
  cel_clouds_4: { dance: 'spin', blocks: ['stars', 'lanterns', 'bubbles'], colors: ['#D6F0FF', '#FFE8A3', '#FF7AA8'] },
  cel_clouds_3: { dance: 'jump', blocks: ['rings', 'bubbles', 'confetti'], colors: ['#5FE3C0', '#D6F0FF', '#FFC857'] },
};

const spec = (id: string): Spec => SPECS[id] ?? SPECS['cel_pond_1']!;

/** Offset/tilt for the idx-th dancer at `beat` beats since the celebration began (8 bars = 32 beats). */
export function danceOffset(id: string, idx: number, beat: number, S: number, reduce: boolean) {
  'worklet';
  if (reduce || beat < 0) return { dx: 0, dy: 0, tilt: 0 };
  const sp = spec(id).dance;
  const k = beat * Math.PI * 2 / 2; // two beats per cycle
  if (sp === 'wave') return { dx: 0, dy: Math.max(0, Math.sin(k - idx * 0.9)) * S * 0.28, tilt: Math.sin(k - idx) * 0.1 };
  if (sp === 'jump') return { dx: 0, dy: Math.abs(Math.sin((beat * Math.PI) / 1 + idx * 0.5)) * S * 0.35, tilt: 0 };
  if (sp === 'spin') return { dx: Math.sin(k * 0.5 + idx * 1.6) * S * 0.18, dy: Math.abs(Math.sin(k)) * S * 0.12, tilt: Math.sin(k + idx) * 0.35 };
  return { dx: Math.sin(k * 0.5 - idx * 0.8) * S * 0.3, dy: Math.abs(Math.sin(beat * Math.PI + idx)) * S * 0.2, tilt: Math.sin(k - idx) * 0.12 };
}

function rnd(seed: number): number {
  'worklet';
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Lights, confetti and friends. Pure function of (time, beat); hard-capped particle counts. */
export function drawCelebration(sk: SkiaApi, c: Canvas, id: string, l: Layout, pal: StagePalette, timeMs: number, beat: number, reduce: boolean) {
  'worklet';
  const sp = spec(id);
  const fadeIn = Math.min(1, Math.max(0, beat) / 2);
  const fadeOut = Math.min(1, Math.max(0, (TUNING.celebrationBars * TUNING.beatsPerBar - beat) / 2));
  const f = Math.min(fadeIn, fadeOut);
  const t = timeMs / 1000;
  for (const b of sp.blocks) {
    if (b === 'beams') {
      for (let i = 0; i < 5; i++) {
        const x = l.W * (0.1 + i * 0.2);
        const a = reduce ? 0 : Math.sin(t * 1.3 + i) * 0.35;
        const p = sk.PathBuilder.Make();
        p.moveTo(x, -4); p.lineTo(x + 10, -4);
        p.lineTo(x + 10 + Math.sin(a) * l.stageH * 0.9 + l.size * 0.5, l.stageH * 0.95);
        p.lineTo(x + Math.sin(a) * l.stageH * 0.9 - l.size * 0.5, l.stageH * 0.95);
        p.close();
        c.drawPath(p.build(), gradientPaint(sk, 0, 0, 0, l.stageH, [sp.colors[i % sp.colors.length]!, '#00000000'], 0.28 * f));
      }
    } else if (b === 'confetti') {
      const n = Math.min(TUNING.confettiMax, 100);
      for (let i = 0; i < n; i++) {
        const sx = rnd(i + 1) * l.W;
        const speed = 40 + rnd(i + 99) * 90;
        const y = ((t * speed + rnd(i + 7) * l.stageH * 1.4) % (l.stageH * 1.15)) - 10;
        const sway = reduce ? 0 : Math.sin(t * 2 + i) * 14;
        c.save();
        c.translate(sx + sway, y);
        c.rotate(reduce ? 0 : (t * 200 + i * 40) % 360, 0, 0);
        c.drawRect(sk.XYWHRect(-4, -2.5, 8, 5), paint(sk, sp.colors[i % sp.colors.length]!, 0.9 * f));
        c.restore();
      }
    } else if (b === 'stars') {
      for (let i = 0; i < 24; i++) {
        const x = rnd(i + 31) * l.W, y = rnd(i + 57) * l.stageH * 0.7;
        const r = 3 + 4 * (0.5 + 0.5 * Math.sin(t * 4 + i * 2));
        c.drawCircle(x, y, r, paint(sk, sp.colors[i % sp.colors.length]!, 0.8 * f));
        c.drawCircle(x, y, r * 2.2, paint(sk, sp.colors[i % sp.colors.length]!, 0.18 * f));
      }
    } else if (b === 'bubbles') {
      for (let i = 0; i < 22; i++) {
        const x = rnd(i + 5) * l.W;
        const y = l.stageH - (((t * (25 + rnd(i + 3) * 35)) + rnd(i + 11) * l.stageH) % l.stageH);
        c.drawCircle(x, y, 6 + rnd(i + 17) * 12, paint(sk, mix(sp.colors[i % sp.colors.length]!, '#FFFFFF', 0.3), 0.35 * f, 1, 1.5));
      }
    } else if (b === 'rings') {
      const cx = l.W / 2, cy = l.stageH * 0.42;
      for (let i = 0; i < 4; i++) {
        const ph = ((beat / 4 + i / 4) % 1);
        c.drawCircle(cx, cy, (0.15 + ph) * l.W * 0.5, paint(sk, sp.colors[i % sp.colors.length]!, (1 - ph) * 0.5 * f, 1, 3));
      }
    } else {
      for (let i = 0; i < 8; i++) {
        const x = l.W * (0.06 + i * 0.125);
        const y = l.stageH * 0.2 + Math.sin(t * 1.2 + i) * 10 + (i % 2) * 22;
        c.drawCircle(x, y, 12, paint(sk, sp.colors[i % sp.colors.length]!, 0.9 * f));
        c.drawCircle(x, y, 26, paint(sk, sp.colors[i % sp.colors.length]!, 0.2 * f));
        c.drawLine(x, 0, x, y - 12, paint(sk, pal.glow, 0.25 * f, 1, 1));
      }
    }
  }
}
