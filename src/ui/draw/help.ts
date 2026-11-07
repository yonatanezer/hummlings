import { computeLayout } from '../../core/layout';
import type { Stage } from '../../core/types';
import { drawScene, type SceneInput } from './scene';
import { paint, STROKE, type Canvas, type SkiaApi } from './common';

export const HELP_STEPS = 7;
export const HELP_LOOP_MS = 4400;

function finger(sk: SkiaApi, c: Canvas, x: number, y: number, pressed: number, alpha: number) {
  'worklet';
  c.drawCircle(x + 3, y + 8, 26, paint(sk, '#000000', 0.25 * alpha));
  c.drawCircle(x, y, 24 - pressed * 3, paint(sk, '#FFFFFF', 0.92 * alpha));
  c.drawCircle(x, y, 24 - pressed * 3, paint(sk, '#FFC857', 0.85 * alpha, STROKE, 3));
  if (pressed > 0) c.drawCircle(x, y, 30 + pressed * 16, paint(sk, '#FFFFFF', 0.35 * alpha, STROKE, 2));
}

/** One looping animated lesson of the how-to-play guide, drawn with the same scene code as the game. */
export function drawHelpStep(sk: SkiaApi, c: Canvas, stage: Stage, step: number, tMs: number, w: number, h: number) {
  'worklet';
  const layout = computeLayout(w, h, undefined, 12);
  const t = tMs % HELP_LOOP_MS;
  const ids = [stage.creatures[0]!.id, stage.creatures[6]!.id, stage.creatures[12]!.id, stage.creatures[18]!.id, stage.creatures[3]!.id, stage.creatures[9]!.id];
  const beat = (tMs / 1000) * (stage.bpm / 60);
  const base: SceneInput = {
    layout, stage, placed: [], muted: {}, solo: null, drags: [], returning: [], scrollX: 0, beat, timeMs: tMs, reduceMotion: false,
    celebration: null, hint: false, recordingBeat: null, hintSlot: 0,
  };
  const place = (n: number, since: (i: number) => number) => ids.slice(0, n).map((id, i) => ({ id, spot: i + 1, since: since(i), from: layout.slotPos[stage.creatures.findIndex((x) => x.id === id)]! }));
  const spot = (i: number) => ({ x: layout.spots[i]!.x, y: layout.spots[i]!.y - layout.size * 0.5 });
  const press = (a: number, b: number) => (t > a && t < b ? Math.sin(((t - a) / (b - a)) * Math.PI) : 0);
  let fx = -100, fy = -100, fp = 0, fa = 0, ring = 0;
  const s: SceneInput = { ...base };
  switch (step) {
    case 0: {
      s.hint = t < 3000; s.hintSlot = 0;
      if (t >= 2900) s.placed = [{ id: ids[0]!, spot: 2, since: 2900, from: layout.slotPos[0]! }];
      break;
    }
    case 1: s.placed = place(4, (i) => i * 1000 + 300).filter((p) => p.since <= t); break;
    case 2: {
      s.placed = place(4, () => -1e6);
      const target = spot(2);
      fx = target.x; fy = target.y; fa = 1; fp = press(900, 1500) + press(2900, 3400);
      if (t > 1400 && t < 2900) s.muted = { [ids[1]!]: true };
      break;
    }
    case 3: {
      s.placed = place(4, () => -1e6);
      const target = spot(2);
      fx = target.x; fy = target.y; fa = 1; fp = t > 600 && t < 3200 ? 1 : 0;
      if (t > 600 && t < 1400) ring = 30 + ((t - 600) / 800) * 40;
      if (t >= 1400 && t < 4000) { // popup opens; dragging down lowers the level
        const k = Math.min(1, Math.max(0, (t - 1700) / 1300));
        const vol = 1 - 0.65 * k;
        s.popup = { spot: 2, creatureId: ids[1]!, volume: vol, solo: false };
        s.volumes = { [ids[1]!]: vol };
        fy = target.y + k * layout.size * 0.5;
      }
      break;
    }
    case 4: {
      s.placed = place(4, () => -1e6);
      const from = spot(2);
      const p = Math.min(1, Math.max(0, (t - 800) / 1400));
      if (t > 800 && t < 2200) {
        s.placed = s.placed.filter((q) => q.id !== ids[1]);
        s.drags = [{ id: ids[1]!, x: from.x, y: from.y + p * (layout.tray.y + 20 - from.y) }];
        fx = from.x; fy = from.y + p * (layout.tray.y + 20 - from.y); fa = 1; fp = 1;
      } else if (t >= 2200) {
        s.placed = s.placed.filter((q) => q.id !== ids[1]);
        s.returning = [{ id: ids[1]!, since: 2200, from: { x: from.x, y: layout.tray.y + 60 } }];
      } else { fx = from.x; fy = from.y; fa = t > 400 ? 1 : 0; }
      break;
    }
    case 5: {
      const combo = stage.combos[0]!;
      s.placed = combo.creatureIds.map((id, i) => ({ id, spot: i + 1, since: -1e6, from: layout.slotPos[0]! }));
      if (t > 1200) s.celebration = { celebrationId: combo.celebrationId, creatureIds: [...combo.creatureIds], startBeat: (1200 / 1000) * (stage.bpm / 60) };
      break;
    }
    default: {
      s.placed = place(3, () => -1e6);
    }
  }
  drawScene(sk, c, s);
  if (ring > 0) c.drawCircle(fx, fy, ring, paint(sk, '#FFE8A3', 0.7, STROKE, 4));
  if (fa > 0) finger(sk, c, fx, fy, fp, fa);
  if (step === 6) {
    const pulse = 0.5 + 0.5 * Math.sin(tMs / 260);
    c.drawCircle(w - 60, 60, 26, paint(sk, '#1B1340', 0.85));
    c.drawCircle(w - 60, 60, 11 + 3 * pulse, paint(sk, '#FF4D6D'));
    c.drawCircle(w - 60, 60, 36, paint(sk, '#FF4D6D', 0.5 * pulse, STROKE, 3));
  }
}
