import type { Creature, Stage } from '../../core/types';
import { LAYER_COLORS } from '../../core/types';
import { TUNING } from '../../core/tuning';
import { beatBounce, blinkOpen, breath, hop, onsetPulse } from '../../core/anim';
import type { Layout } from '../../core/layout';
import type { CoachCue } from '../../core/coach';
import { IDLE_POSE, bodyDims, drawCreature, type Pose } from './creature';
import { gradientPaint, mix, freshPaint, paint, radialPaint, STROKE, type Canvas, type SkiaApi, rect } from './common';
import { drawCelebration, danceOffset } from './celebrations';
import { drawDecor, drawScenery, drawTaps, type TapEffect } from './scenery';
import { popupRects } from '../../core/layout';
import type { SkImage, SkPicture } from '@shopify/react-native-skia';

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
  coach?: CoachCue | null; // the wordless coach: a hand that shows the next step
  taps?: TapEffect[]; // tap-the-scenery effects
  reward?: { progress: number } | null; // ring that fills while a complete secret combo is being held
  backdrop?: SkPicture | null; // pre-recorded static sky/scenery (app only; headless renders draw it directly)
  trayPicture?: SkPicture | null; // pre-recorded singer menu (app only; headless renders draw it directly)
  backdropImage?: SkImage | null; // the backdrop rasterised once per change (app only): replaying its vector ops every frame was a large part of the UI-thread cost
  trayImage?: SkImage | null; // the singer menu rasterised once per change (app only)
  pixelRatio?: number; // device pixels per layout unit that the two images were rendered at
  trayK?: number; // 1 = singer menu shown, 0 = slid away (animated by the screen)
  popup?: { spot: number; creatureId: string; volume: number; solo: boolean } | null; // volume popup after a long press
  volumes?: Record<string, number>;
}

export function idHash(id: string): number {
  'worklet';
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Twinkling stars: the only moving part of the sky, drawn each frame with one shared paint. */
export function drawStars(sk: SkiaApi, c: Canvas, l: Layout, timeMs: number) {
  'worklet';
  const { W } = l;
  const p = freshPaint(sk, '#FFFFFF', 1);
  for (let i = 0; i < 40; i++) {
    const r1 = Math.sin(i * 12.9898 + 1.7) * 43758.5453, r2 = Math.sin(i * 78.233 + 3.1) * 24634.6345;
    const x = (r1 - Math.floor(r1)) * W;
    const y = (r2 - Math.floor(r2)) * l.stageH * 0.6;
    const tw = 0.5 + 0.5 * Math.sin(timeMs / 900 + i);
    p.setAlphaf(0.3 + 0.5 * tw);
    c.drawCircle(x, y, 1 + (i % 3) * 0.6, p);
  }
}

/** Everything behind the singers that never moves: sky, spotlights, floor and each world's fixed scenery. Cached as a picture (see SceneCanvas). `bucket` only matters for neon (windows re-roll every 1.8 s). */
export function drawBackdrop(sk: SkiaApi, c: Canvas, st: Stage, l: Layout, bucket: number) {
  'worklet';
  const { W, H } = l;
  const pal = st.palette;
  c.drawRect(rect(0, 0, W, H), gradientPaint(sk, 0, 0, 0, l.stageH, [mix(pal.sky, '#0B0722', 0.5), pal.sky, mix(pal.sky, pal.floor, 0.5)]));
  // warm spotlights from above (about 20%)
  for (let i = 0; i < 3; i++) {
    const x = W * (0.25 + i * 0.25);
    const p = sk.PathBuilder.Make();
    p.moveTo(x - 6, 0); p.lineTo(x + 6, 0); p.lineTo(x + l.size * 1.1, l.stageH * 0.92); p.lineTo(x - l.size * 1.1, l.stageH * 0.92); p.close();
    c.drawPath(p.build(), gradientPaint(sk, 0, 0, 0, l.stageH, [pal.glow, '#00000000'], 0.2));
  }
  // stage floor: wide ellipse with a lit rim
  const floorY = l.stageH * 0.93;
  const fr = rect(-W * 0.05, floorY - l.H * 0.2, W * 1.1, l.H * 0.5);
  c.drawOval(fr, gradientPaint(sk, 0, floorY - l.H * 0.2, 0, floorY + l.H * 0.1, [mix(pal.floor, '#FFFFFF', 0.12), pal.floor]));
  c.drawOval(fr, paint(sk, pal.glow, 0.25, STROKE, 2));
  drawScenery(sk, c, st.id, l, pal, bucket * 1800, 'static');
}

function spotRing(sk: SkiaApi, c: Canvas, x: number, y: number, S: number, glow: string, hot: boolean) {
  'worklet';
  const r = rect(x - S * 0.42, y - S * 0.06, S * 0.84, S * 0.14);
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
    level: s.volumes?.[cr.id] ?? 1,
    lift: !bounce || muted || s.reduceMotion ? 0 : pulse * s.layout.size * 0.07, // little hop on every sung/played note
    ...base,
  };
}

export function creatureFeet(s: SceneInput, id: string): { x: number; y: number } | null {
  'worklet';
  const p = s.placed.find((q) => q.id === id);
  return p ? s.layout.spots[p.spot]! : null;
}

/** The singer menu as one self-contained drawing (panel, group captions, singers). Static between touches, so the app records it once as a Picture. */
export function drawTray(sk: SkiaApi, c: Canvas, s: SceneInput) {
  'worklet';
  const { layout: l, stage } = s;
  c.drawRect(rect(0, l.tray.y, l.W, l.tray.h + 6), paint(sk, mix(stage.palette.sky, '#000000', 0.55), 0.94));
  c.drawRect(rect(0, l.tray.y, l.W, 2), paint(sk, stage.palette.glow, 0.25));
  c.drawRRect(sk.RRectXY(rect(l.W / 2 - 24, l.tray.y + 5, 48, 5), 2.5, 2.5), paint(sk, '#FFFFFF', 0.35)); // grab bar
  c.save();
  c.clipRect(rect(0, l.tray.y + 2, l.W, l.tray.h), 1, true);
  const per = stage.creatures.length / 4;
  [0, 1, 2, 3].forEach((g) => {
    const a = l.slotPos[g * per]!, b = l.slotPos[g * per + per - 1]!;
    const layer = stage.creatures[g * per]!.layer;
    c.drawRRect(sk.RRectXY(rect(a.x - l.slot * 0.55 - s.scrollX, l.tray.y + l.tray.h * 0.08, b.x - a.x + l.slot * 1.1, l.tray.h * 0.84), 14, 14), paint(sk, LAYER_COLORS[layer], 0.16));
  });
  const trayS = Math.min(l.slot * 0.74, (l.tray.h - 12) / 1.4); // leaves a little air above the tallest singer
  stage.creatures.forEach((cr, i) => {
    const p = l.slotPos[i]!;
    const standing = s.placed.some((q) => q.id === cr.id);
    const carried = s.drags.some((d) => d.id === cr.id);
    const base: Partial<Pose> = standing || carried ? { sat: 0, alpha: 0.22, mouth: 0, eyes: 1 } : { mouth: 0 };
    const pose = { ...IDLE_POSE, ...base, sx: 1, sy: 1 };
    drawCreature(sk, c, cr, p.x - s.scrollX, l.tray.y + l.tray.h - 10, trayS, pose);
  });
  c.restore();
}

/** Countdown to a secret combo's celebration: a gold ring that fills, with a star that pulses on the beat. */
function drawRewardRing(sk: SkiaApi, c: Canvas, s: SceneInput) {
  'worklet';
  const l = s.layout, p = s.reward!.progress;
  const cx = l.W / 2, cy = Math.max(l.H * 0.2, 96), r = Math.max(30, l.size * 0.26);
  const pulse = s.reduceMotion ? 0 : Math.max(0, 1 - (s.beat % 1) * 3);
  c.drawCircle(cx, cy, r + 8 + pulse * 4, radialPaint(sk, cx, cy, r + 14, ['#FFE066', '#00000000'], 0.25 + 0.5 * p));
  c.drawCircle(cx, cy, r, paint(sk, '#1B1340', 0.92));
  c.drawCircle(cx, cy, r - 5, paint(sk, '#FFFFFF', 0.22, STROKE, 7));
  const ov = rect(cx - r + 5, cy - r + 5, (r - 5) * 2, (r - 5) * 2);
  c.drawArc(ov, -90, Math.max(1, 360 * p), false, paint(sk, '#FFC857', 1, STROKE, 7));
  const q = sk.PathBuilder.Make();
  const sr = r * (0.5 + 0.06 * pulse);
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, d = k % 2 ? sr * 0.42 : sr; if (k === 0) q.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); else q.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  q.close();
  c.drawPath(q.build(), paint(sk, '#FFE066'));
}

function drawVolumePopup(sk: SkiaApi, c: Canvas, s: SceneInput) {
  'worklet';
  const p = s.popup!;
  const r = popupRects(s.layout, p.spot);
  const cr = s.stage.creatures.find((q) => q.id === p.creatureId);
  const col = cr ? LAYER_COLORS[cr.layer] : '#FFC857';
  c.drawRRect(sk.RRectXY(rect(r.panel.x, r.panel.y, r.panel.w, r.panel.h), 18, 18), paint(sk, '#1B1340', 0.94));
  c.drawRRect(sk.RRectXY(rect(r.panel.x, r.panel.y, r.panel.w, r.panel.h), 18, 18), paint(sk, '#FFFFFF', 0.3, STROKE, 2));
  // solo star button
  const cx = r.solo.x + r.solo.w / 2, cy = r.solo.y + r.solo.h / 2, rr = r.solo.w * 0.4;
  c.drawCircle(cx, cy, rr, paint(sk, p.solo ? '#FFC857' : '#33276E', 1));
  const q = sk.PathBuilder.Make();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, d = k % 2 ? rr * 0.4 : rr * 0.78; if (k === 0) q.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); else q.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  q.close();
  c.drawPath(q.build(), paint(sk, p.solo ? '#7A4A00' : '#FFE066'));
  // slider
  const tw = r.slider.w * 0.34, tx = r.slider.x + (r.slider.w - tw) / 2;
  c.drawRRect(sk.RRectXY(rect(tx, r.slider.y, tw, r.slider.h), tw / 2, tw / 2), paint(sk, '#FFFFFF', 0.18));
  const fh = r.slider.h * p.volume;
  c.drawRRect(sk.RRectXY(rect(tx, r.slider.y + r.slider.h - fh, tw, fh), tw / 2, tw / 2), paint(sk, col, 1));
  c.drawCircle(r.slider.x + r.slider.w / 2, r.slider.y + r.slider.h - fh, r.slider.w * 0.3, paint(sk, '#FFFFFF', 1));
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

/**
 * The wordless coach for children who cannot read: a hand that shows the next step.
 * 'drag': a singer is carried from the tray to a spot (the slot pulses first); 'tap': a finger taps a singer on stage twice.
 */
function drawCoachHand(sk: SkiaApi, c: Canvas, s: SceneInput, cue: CoachCue, byId: Record<string, Creature>) {
  'worklet';
  const l = s.layout;
  if (cue.kind === 'hold') {
    // press and hold: the finger stays down while a ring fills, then the volume slider opens beside the singer
    const t = (s.timeMs % 3600) / 3600;
    const p = l.spots[cue.spot]!;
    const x = p.x + l.size * 0.1, y = p.y - l.size * 0.5;
    const fade = t > 0.92 ? (1 - t) / 0.08 : 1;
    const fill = Math.min(1, Math.max(0, (t - 0.1) / 0.45));
    c.drawCircle(x + 3, y + 8, 26, paint(sk, '#000000', 0.25 * fade));
    c.drawCircle(x, y, 22, paint(sk, '#FFFFFF', 0.92 * fade));
    c.drawCircle(x, y, 22, paint(sk, '#FFC857', 0.85 * fade, STROKE, 3));
    c.drawCircle(x, y, 28 + fill * 22, paint(sk, '#FFE8A3', (0.25 + 0.5 * (1 - fill)) * fade, STROKE, 4));
    if (t > 0.55) {
      const open = Math.min(1, (t - 0.55) / 0.12);
      const tx = p.x + l.size * 0.62, top = y - l.size * 0.45, hh = l.size * 0.9;
      c.drawRRect(sk.RRectXY(rect(tx - 5, top, 10, hh), 5, 5), paint(sk, '#FFFFFF', 0.35 * open * fade));
      const knob = top + hh * (0.15 + 0.7 * Math.min(1, Math.max(0, (t - 0.68) / 0.22)));
      c.drawCircle(tx, knob, 13, paint(sk, '#FFE8A3', open * fade));
    }
    return;
  }
  if (cue.kind === 'tap') {
    const t = (s.timeMs % 2600) / 2600;
    const k = (t * 2) % 1; // two taps per loop
    const press = k > 0.25 && k < 0.6 ? Math.sin(((k - 0.25) / 0.35) * Math.PI) : 0;
    const p = l.spots[cue.spot]!;
    const x = p.x + l.size * 0.12, y = p.y - l.size * 0.5 + (1 - press) * l.size * 0.28;
    const fade = t > 0.9 ? (1 - t) / 0.1 : 1;
    c.drawCircle(x + 3, y + 8, 26, paint(sk, '#000000', 0.25 * fade));
    c.drawCircle(x, y, 24 - press * 3, paint(sk, '#FFFFFF', 0.92 * fade));
    c.drawCircle(x, y, 24 - press * 3, paint(sk, '#FFC857', 0.85 * fade, STROKE, 3));
    if (press > 0.5) c.drawCircle(x, y, 30 + (press - 0.5) * 70, paint(sk, '#FFFFFF', 0.5 * (1 - press) * 2 * fade, STROKE, 3));
    return;
  }
  const t = (s.timeMs % 4000) / 4000;
  const from = { x: l.slotPos[cue.slot]!.x - s.scrollX, y: l.slotPos[cue.slot]!.y };
  const to = { x: l.spots[cue.spot]!.x, y: l.spots[cue.spot]!.y - l.size * 0.4 };
  const move = Math.min(1, Math.max(0, (t - 0.15) / 0.55));
  const e = move * move * (3 - 2 * move);
  const x = from.x + (to.x - from.x) * e;
  const y = from.y + (to.y - from.y) * e - Math.sin(e * Math.PI) * l.size * 0.25;
  const fade = t < 0.08 ? t / 0.08 : t > 0.88 ? (1 - t) / 0.12 : 1;
  // the slot of the singer that moves glows, and the spot it goes to shows a ring, so the eye finds both ends
  const glow = 0.5 + 0.5 * Math.sin(s.timeMs / 220);
  c.drawCircle(from.x, from.y, l.slot * (0.55 + 0.05 * glow), paint(sk, '#FFE8A3', 0.5 * fade * (move < 0.05 ? 1 : 0.4), STROKE, 4));
  c.drawOval(rect(l.spots[cue.spot]!.x - l.size * 0.55, l.spots[cue.spot]!.y - l.size * 0.14, l.size * 1.1, l.size * 0.3), paint(sk, '#FFE8A3', 0.55 * fade, STROKE, 4));
  const cr = byId[s.stage.creatures[cue.slot]!.id];
  if (cr && move > 0) drawCreature(sk, c, cr, x, y + l.size * 0.45, l.size * 0.9, { ...IDLE_POSE, alpha: 0.85 * fade });
  const pressed = move > 0 && move < 1 ? 1 : 0;
  c.drawCircle(x + 3, y + 8, 26, paint(sk, '#000000', 0.25 * fade));
  c.drawCircle(x, y, 24 - pressed * 2, paint(sk, '#FFFFFF', 0.92 * fade));
  c.drawCircle(x, y, 24 - pressed * 2, paint(sk, '#FFC857', 0.85 * fade, STROKE, 3));
  c.drawCircle(x, y, 38 + 6 * Math.sin(t * 40), paint(sk, '#FFFFFF', 0.35 * fade * (1 - move), STROKE, 2));
}

/** Draws a pre-rasterised image 1:1 in device pixels (it was rendered at pixelRatio x the layout size). */
function drawRaster(c: Canvas, img: SkImage, ratio: number) {
  'worklet';
  c.save();
  c.scale(1 / ratio, 1 / ratio);
  c.drawImage(img, 0, 0);
  c.restore();
}

// Must stay below every helper it calls: the worklet transform captures a function when its definition is reached, so a helper declared later is undefined inside it.
export function drawScene(sk: SkiaApi, c: Canvas, s: SceneInput) {
  'worklet';
  const { layout: l, stage } = s;
  if (s.backdropImage) drawRaster(c, s.backdropImage, s.pixelRatio ?? 1); else if (s.backdrop) c.drawPicture(s.backdrop); else drawBackdrop(sk, c, stage, l, Math.floor(s.timeMs / 1800));
  drawStars(sk, c, l, s.timeMs);
  drawScenery(sk, c, stage.id, l, stage.palette, s.timeMs, 'live');
  drawDecor(sk, c, stage.id, l, stage.palette, s.timeMs, s.reduceMotion ? 0 : s.beat);
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
      c.drawOval(rect(p.x - l.size * 0.55, p.y - l.size * 0.12, l.size * 1.1, l.size * 0.28), radialPaint(sk, p.x, p.y, l.size * 0.55, ['#FFFFFF', stage.palette.glow, '#00000000'], 0.6));
      c.drawOval(rect(p.x - l.size * 0.5, p.y - l.size * 0.09, l.size, l.size * 0.22), paint(sk, '#FFFFFF', 0.95, STROKE, 3));
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
      c.drawRect(rect(0, 0, l.W, l.stageH), paint(sk, '#05031A', 0.45));
      c.drawPath(p.build(), gradientPaint(sk, 0, 0, 0, f.y, [stage.palette.glow, mix(stage.palette.glow, '#FFFFFF', 0.4)], 0.32));
      c.drawOval(rect(f.x - l.size * 0.7, f.y - l.size * 0.08, l.size * 1.4, l.size * 0.2), radialPaint(sk, f.x, f.y, l.size * 0.7, [mix(stage.palette.glow, '#FFFFFF', 0.5), '#00000000'], 0.5));
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

  if (s.taps?.length) drawTaps(sk, c, s.taps, s.timeMs);
  if (s.popup) drawVolumePopup(sk, c, s);
  if (s.reward && !s.celebration) drawRewardRing(sk, c, s);

  // tray (singer menu): slides down out of view on a swipe; a handle tab at the bottom edge brings it back
  const trayK = s.trayK ?? 1;
  const trayDy = (1 - trayK) * (l.tray.h + 6);
  c.save();
  c.translate(0, trayDy);
  if (s.trayImage) drawRaster(c, s.trayImage, s.pixelRatio ?? 1); else if (s.trayPicture) c.drawPicture(s.trayPicture); else drawTray(sk, c, s);
  c.restore(); // end of the sliding tray
  if (trayK < 0.98) {
    const hy = l.H - 34 * (1 - trayK);
    c.drawRRect(sk.RRectXY(rect(l.W / 2 - 42, hy, 84, 40), 14, 14), paint(sk, '#1B1340', 0.95));
    c.drawRRect(sk.RRectXY(rect(l.W / 2 - 42, hy, 84, 40), 14, 14), paint(sk, '#FFFFFF', 0.5, STROKE, 2));
    const q = sk.PathBuilder.Make();
    q.moveTo(l.W / 2 - 12, hy + 20); q.lineTo(l.W / 2, hy + 10); q.lineTo(l.W / 2 + 12, hy + 20);
    c.drawPath(q.build(), paint(sk, '#FFFFFF', 1, STROKE, 3.2));
  }

  // creatures returning to the tray
  for (const r of s.returning) {
    const cr = byId[r.id];
    if (!cr) continue;
    const i = stage.creatures.indexOf(cr);
    const to = { x: l.slotPos[i]!.x - s.scrollX, y: l.tray.y + l.tray.h - 10 + trayDy };
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
  if (s.coach && s.drags.length === 0 && !s.popup) drawCoachHand(sk, c, s, s.coach, byId);
}
