import type { Creature, Stage } from '../../core/types';
import { LAYER_COLORS } from '../../core/types';
import { TUNING } from '../../core/tuning';
import { beatBounce, blinkOpen, breath, hop, onsetPulse } from '../../core/anim';
import type { Layout } from '../../core/layout';
import { IDLE_POSE, bodyDims, drawCreature, type Pose } from './creature';
import { gradientPaint, mix, paint, radialPaint, STROKE, type Canvas, type SkiaApi } from './common';
import { drawCelebration, danceOffset } from './celebrations';

export interface PlacedCreature { id: string; spot: number; since: number; from: { x: number; y: number } }
export interface DragCreature { id: string; x: number; y: number }
export interface ReturningCreature { id: string; since: number; from: { x: number; y: number } }

/** Everything the scene needs for one frame. Plain data so it can live in a shared value. */
export interface SceneInput {
  layout: Layout;
  stage: Stage;
  placed: PlacedCreature[];
  muted: Record<string, true>;
  solo: string | null;
  drags: DragCreature[];
  returning: ReturningCreature[];
  scrollX: number;
  beat: number; // float, -1 before the clock starts
  timeMs: number;
  reduceMotion: boolean;
  celebration: { celebrationId: string; creatureIds: string[]; startBeat: number } | null;
  hint: boolean; // first-run animated hand
  recordingBeat: number | null; // for the REC pulse (null = not recording)
  hintSlot: number;
}

export function idHash(id: string): number {
  'worklet';
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return h;
}

export function drawBackground(sk: SkiaApi, c: Canvas, st: Stage, l: Layout, timeMs: number) {
  'worklet';
  const { W, H } = l;
  const pal = st.palette;
  c.drawRect(sk.XYWHRect(0, 0, W, H), gradientPaint(sk, 0, 0, 0, l.stageH, [mix(pal.sky, '#0B0722', 0.5), pal.sky, mix(pal.sky, pal.floor, 0.5)]));
  // soft stars
  for (let i = 0; i < 40; i++) {
    const r1 = Math.sin(i * 12.9898 + 1.7) * 43758.5453, r2 = Math.sin(i * 78.233 + 3.1) * 24634.6345;
    const x = (r1 - Math.floor(r1)) * W;
    const y = (r2 - Math.floor(r2)) * l.stageH * 0.6;
    const tw = 0.5 + 0.5 * Math.sin(timeMs / 900 + i);
    c.drawCircle(x, y, 1 + (i % 3) * 0.6, paint(sk, '#FFFFFF', 0.3 + 0.5 * tw));
  }
  // warm spotlights from above (about 20%)
  for (let i = 0; i < 3; i++) {
    const x = W * (0.25 + i * 0.25);
    const p = sk.PathBuilder.Make();
    p.moveTo(x - 6, 0); p.lineTo(x + 6, 0); p.lineTo(x + l.size * 1.1, l.stageH * 0.92); p.lineTo(x - l.size * 1.1, l.stageH * 0.92); p.close();
    c.drawPath(p.build(), gradientPaint(sk, 0, 0, 0, l.stageH, [pal.glow, '#00000000'], 0.2));
  }
  // stage floor: wide ellipse with a lit rim
  const floorY = l.stageH * 0.93;
  const fr = sk.XYWHRect(-W * 0.05, floorY - l.H * 0.2, W * 1.1, l.H * 0.5);
  c.drawOval(fr, gradientPaint(sk, 0, floorY - l.H * 0.2, 0, floorY + l.H * 0.1, [mix(pal.floor, '#FFFFFF', 0.12), pal.floor]));
  c.drawOval(fr, paint(sk, pal.glow, 0.25, STROKE, 2));
  // tray panel
  c.drawRect(sk.XYWHRect(0, l.tray.y, W, l.tray.h), paint(sk, mix(pal.sky, '#000000', 0.55), 0.92));
  c.drawRect(sk.XYWHRect(0, l.tray.y, W, 2), paint(sk, pal.glow, 0.25));
}

function spotRing(sk: SkiaApi, c: Canvas, x: number, y: number, S: number, glow: string, hot: boolean) {
  'worklet';
  const r = sk.XYWHRect(x - S * 0.42, y - S * 0.06, S * 0.84, S * 0.14);
  c.drawOval(r, paint(sk, glow, hot ? 0.5 : 0.22, STROKE, 2));
}

function poseFor(cr: Creature, s: SceneInput, base: Partial<Pose>, bounce: boolean): Pose {
  'worklet';
  const seed = idHash(cr.id);
  const muted = s.muted[cr.id] === true;
  const b = bounce && !muted ? beatBounce(s.beat, s.reduceMotion) : { sx: 1, sy: 1 };
  const pulse = muted || s.reduceMotion ? 0 : onsetPulse(cr.onsets, s.beat);
  const br = s.reduceMotion ? 0.5 : breath(s.timeMs, (seed % 628) / 100);
  const dim = s.solo !== null && s.solo !== cr.id;
  return {
    ...IDLE_POSE,
    sx: b.sx * (1 - 0.01 * br),
    sy: b.sy * (1 + 0.015 * br),
    mouth: cr.layer === 'drums' ? pulse * 0.5 : pulse,
    eyes: s.reduceMotion ? 1 : blinkOpen(s.timeMs + (seed % 3000), seed),
    muted,
    alpha: dim ? TUNING.soloDimOpacity : 1,
    arms: pulse * (seed % 2 ? 1 : -1),
    glow: s.solo === cr.id ? 1 : 0,
    time: s.reduceMotion ? 0 : s.timeMs + (seed % 1000),
    lift: !bounce || muted || s.reduceMotion ? 0 : pulse * s.layout.size * 0.07, // little hop on every sung/played note
    ...base,
  };
}

export function creatureFeet(s: SceneInput, id: string): { x: number; y: number } | null {
  'worklet';
  const p = s.placed.find((q) => q.id === id);
  return p ? s.layout.spots[p.spot]! : null;
}

export function drawScene(sk: SkiaApi, c: Canvas, s: SceneInput) {
  'worklet';
  const { layout: l, stage } = s;
  drawBackground(sk, c, stage, l, s.timeMs);
  const byId: Record<string, Creature> = {};
  for (const cr of stage.creatures) byId[cr.id] = cr;
  const danceIds = s.celebration ? s.celebration.creatureIds : [];

  // spot rings; the spot a carried creature would land on lights up (drop target), empty spots show a "+" while the stage is young
  let target = -1;
  if (s.drags.length) {
    const d = s.drags[s.drags.length - 1]!;
    let best = Infinity;
    l.spots.forEach((p, i) => { const dist = Math.hypot(d.x - p.x, d.y - (p.y - l.size * 0.5)); if (dist < l.size * 0.62 && dist < best) { best = dist; target = i; } });
  }
  l.spots.forEach((p, i) => {
    const occupied = s.placed.some((q) => q.spot === i);
    if (i === target) {
      c.drawOval(sk.XYWHRect(p.x - l.size * 0.55, p.y - l.size * 0.12, l.size * 1.1, l.size * 0.28), radialPaint(sk, p.x, p.y, l.size * 0.55, ['#FFFFFF', stage.palette.glow, '#00000000'], 0.6));
      c.drawOval(sk.XYWHRect(p.x - l.size * 0.5, p.y - l.size * 0.09, l.size, l.size * 0.22), paint(sk, '#FFFFFF', 0.95, STROKE, 3));
    } else spotRing(sk, c, p.x, p.y, l.size, stage.palette.glow, occupied);
    if (!occupied && s.placed.length < 3 && !s.drags.length && !s.reduceMotion) {
      const a = 0.3 + 0.2 * Math.sin(s.timeMs / 500 + i);
      const cx = p.x, cy = p.y - l.size * 0.32, r = l.size * 0.09;
      c.drawLine(cx - r, cy, cx + r, cy, paint(sk, stage.palette.glow, a, STROKE, 3));
      c.drawLine(cx, cy - r, cx, cy + r, paint(sk, stage.palette.glow, a, STROKE, 3));
    }
  });

  // solo spotlight cone
  if (s.solo) {
    const f = creatureFeet(s, s.solo);
    if (f) {
      const p = sk.PathBuilder.Make();
      p.moveTo(f.x - 8, 0); p.lineTo(f.x + 8, 0); p.lineTo(f.x + l.size * 0.9, f.y + 6); p.lineTo(f.x - l.size * 0.9, f.y + 6); p.close();
      c.drawRect(sk.XYWHRect(0, 0, l.W, l.stageH), paint(sk, '#05031A', 0.45));
      c.drawPath(p.build(), gradientPaint(sk, 0, 0, 0, f.y, [stage.palette.glow, mix(stage.palette.glow, '#FFFFFF', 0.4)], 0.32));
      c.drawOval(sk.XYWHRect(f.x - l.size * 0.7, f.y - l.size * 0.08, l.size * 1.4, l.size * 0.2), radialPaint(sk, f.x, f.y, l.size * 0.7, [mix(stage.palette.glow, '#FFFFFF', 0.5), '#00000000'], 0.5));
    }
  }

  if (s.celebration) drawCelebration(sk, c, s.celebration.celebrationId, l, stage.palette, s.timeMs, s.beat - s.celebration.startBeat, s.reduceMotion);

  // creatures on stage, back row first (higher on screen = further back)
  const order = [...s.placed].sort((a, b) => l.spots[a.spot]!.y - l.spots[b.spot]!.y);
  for (const pl of order) {
    const cr = byId[pl.id];
    if (!cr) continue;
    const to = l.spots[pl.spot]!;
    const age = s.timeMs - pl.since;
    const dragged = s.drags.some((d) => d.id === pl.id);
    if (dragged) continue;
    let pos = { x: to.x, y: to.y, sx: 1, sy: 1 };
    if (age < TUNING.hopMs && !s.reduceMotion) pos = hop(pl.from, to, age / TUNING.hopMs, l.size * 0.5);
    else if (age < TUNING.hopMs) pos = { x: to.x, y: to.y, sx: 1, sy: 1 };
    const dance = danceIds.includes(pl.id) && s.celebration ? danceOffset(s.celebration.celebrationId, danceIds.indexOf(pl.id), s.beat - s.celebration.startBeat, l.size, s.reduceMotion) : { dx: 0, dy: 0, tilt: 0 };
    const pose = poseFor(cr, s, { lift: dance.dy, tilt: dance.tilt }, age >= TUNING.hopMs);
    pose.sx *= pos.sx; pose.sy *= pos.sy;
    drawCreature(sk, c, cr, pos.x + dance.dx, pos.y, l.size, pose);
    // state badges: muted = speaker with a slash, solo = star
    const isMuted = s.muted[pl.id] === true, isSolo = s.solo === pl.id;
    if (isMuted || isSolo) {
      const bx = pos.x + l.size * 0.36, by = pos.y - bodyDims(cr.shape.body).h * l.size - l.size * 0.02, r = l.size * 0.12;
      c.drawCircle(bx, by, r, paint(sk, isSolo ? '#FFC857' : '#1B1340', 0.95));
      c.drawCircle(bx, by, r, paint(sk, '#FFFFFF', 0.9, STROKE, 2));
      if (isMuted) {
        const q = sk.PathBuilder.Make();
        q.moveTo(bx - r * 0.55, by - r * 0.22); q.lineTo(bx - r * 0.2, by - r * 0.22); q.lineTo(bx + r * 0.2, by - r * 0.55); q.lineTo(bx + r * 0.2, by + r * 0.55); q.lineTo(bx - r * 0.2, by + r * 0.22); q.lineTo(bx - r * 0.55, by + r * 0.22); q.close();
        c.drawPath(q.build(), paint(sk, '#FFFFFF'));
        c.drawLine(bx - r * 0.6, by + r * 0.6, bx + r * 0.6, by - r * 0.6, paint(sk, '#FF6F91', 1, STROKE, 2.5));
      } else {
        const q = sk.PathBuilder.Make();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.35 : r * 0.7; if (k === 0) q.moveTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr); else q.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr); }
        q.close();
        c.drawPath(q.build(), paint(sk, '#7A4A00'));
      }
    }
  }

  // tray
  c.save();
  c.clipRect(sk.XYWHRect(0, l.tray.y + 2, l.W, l.tray.h), 1, true);
  const per = stage.creatures.length / 4;
  [0, 1, 2, 3].forEach((g) => {
    const a = l.slotPos[g * per]!, b = l.slotPos[g * per + per - 1]!;
    const layer = stage.creatures[g * per]!.layer;
    c.drawRRect(sk.RRectXY(sk.XYWHRect(a.x - l.slot * 0.55 - s.scrollX, l.tray.y + l.tray.h * 0.08, b.x - a.x + l.slot * 1.1, l.tray.h * 0.84), 14, 14), paint(sk, LAYER_COLORS[layer], 0.11));
  });
  const trayS = Math.min(l.slot * 0.72, l.tray.h * 0.46);
  stage.creatures.forEach((cr, i) => {
    const p = l.slotPos[i]!;
    const standing = s.placed.some((q) => q.id === cr.id);
    const carried = s.drags.some((d) => d.id === cr.id);
    const base: Partial<Pose> = standing || carried ? { sat: 0, alpha: 0.22, mouth: 0, eyes: 1 } : { mouth: 0 };
    const pose = { ...IDLE_POSE, ...base, sx: 1, sy: 1 + (standing ? 0 : 0.012 * (s.reduceMotion ? 0.5 : breath(s.timeMs, i))) };
    drawCreature(sk, c, cr, p.x - s.scrollX, p.y + trayS * 0.55, trayS, pose);
  });
  c.restore();

  // creatures returning to the tray
  for (const r of s.returning) {
    const cr = byId[r.id];
    if (!cr) continue;
    const i = stage.creatures.indexOf(cr);
    const to = { x: l.slotPos[i]!.x - s.scrollX, y: l.slotPos[i]!.y + Math.min(l.slot * 0.72, l.tray.h * 0.46) * 0.55 };
    const q = hop(r.from, to, (s.timeMs - r.since) / TUNING.hopMs, l.size * 0.4);
    drawCreature(sk, c, cr, q.x, q.y, l.size * (1 - 0.25 * Math.min(1, (s.timeMs - r.since) / TUNING.hopMs)), { ...IDLE_POSE, ...{} });
  }

  // creatures being dragged, on top
  for (const d of s.drags) {
    const cr = byId[d.id];
    if (!cr) continue;
    const { h } = bodyDims(cr.shape.body);
    drawCreature(sk, c, cr, d.x, d.y + l.size * h * 0.5, l.size * TUNING.dragLift, { ...IDLE_POSE, mouth: 0.4, tilt: 0.06 });
  }

  if (s.hint && s.drags.length === 0) drawHintHand(sk, c, s, byId);
}

/** First-run: an animated hand drags a creature from the tray to the stage; repeats every 4 s. */
function drawHintHand(sk: SkiaApi, c: Canvas, s: SceneInput, byId: Record<string, Creature>) {
  'worklet';
  const l = s.layout;
  const t = (s.timeMs % 4000) / 4000;
  const from = { x: l.slotPos[s.hintSlot]!.x - s.scrollX, y: l.slotPos[s.hintSlot]!.y };
  const to = { x: l.spots[2]!.x, y: l.spots[2]!.y - l.size * 0.4 };
  const move = Math.min(1, Math.max(0, (t - 0.15) / 0.55));
  const e = move * move * (3 - 2 * move);
  const x = from.x + (to.x - from.x) * e;
  const y = from.y + (to.y - from.y) * e - Math.sin(e * Math.PI) * l.size * 0.25;
  const fade = t < 0.08 ? t / 0.08 : t > 0.88 ? (1 - t) / 0.12 : 1;
  const cr = Object.values(byId).find((q) => q.id === s.stage.creatures[s.hintSlot]!.id);
  if (cr && move > 0) drawCreature(sk, c, cr, x, y + l.size * 0.45, l.size * 0.9, { ...IDLE_POSE, alpha: 0.85 * fade });
  // finger
  const pressed = move > 0 && move < 1 ? 1 : 0;
  c.drawCircle(x + 3, y + 8, 26, paint(sk, '#000000', 0.25 * fade));
  c.drawCircle(x, y, 24 - pressed * 2, paint(sk, '#FFFFFF', 0.9 * fade));
  c.drawCircle(x, y, 24 - pressed * 2, paint(sk, '#FFC857', 0.8 * fade, STROKE, 3));
  c.drawCircle(x, y, 38 + 6 * Math.sin(t * 40), paint(sk, '#FFFFFF', 0.35 * fade * (1 - move), STROKE, 2));
}
