// Playable web demo of Hummlings (Canvas 2D + Web Audio) using the real core logic and the real loops.
import { beatBounce, blinkOpen, breath, hop, onsetPulse } from '../src/core/anim';
import { GestureTracker, type GestureEvent, type World } from '../src/core/gestures';
import { computeLayout, type Layout } from '../src/core/layout';
import { Session } from '../src/core/session';
import { TUNING } from '../src/core/tuning';
import { LAYER_COLORS, type Creature, type Stage } from '../src/core/types';
import { validateStage } from '../src/core/schema';
import pond from '../content/stages/1-pond.json';
import fair from '../content/stages/2-fair.json';
import clouds from '../content/stages/3-clouds.json';
import { WebEngine } from './engine';
import { en } from '../src/i18n/en';
import { popRate } from '../src/core/sfx';

const STAGES: Stage[] = [pond, fair, clouds].map((r) => validateStage(r).stage!);
const NAMES = ['Moonlit Pond', 'Candy Fair', 'Sleepy Cloud Town'];
const CELL_W = 220, CELL_H = 240, FEET_X = 110, FEET_Y = 222, SPRITE_S = 120;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const engine = new WebEngine();
engine.base = '';
let stageIdx = 0;
let stage = STAGES[0]!;
let session: Session | null = null;
let atlas: HTMLImageElement | null = null;
let layout: Layout = computeLayout(844, 390);
let W = 844, H = 390;
let scrollX = 0;
const tracker = new GestureTracker();
const placedAnim = new Map<string, { since: number; from: { x: number; y: number } }>();
let drags: { id: string; x: number; y: number }[] = [];
let returning: { id: string; since: number; from: { x: number; y: number } }[] = [];
let celebration: { comboId: string; creatureIds: string[]; startBeat: number } | null = null;
const ripples: { x: number; y: number; t: number }[] = [];
let ready = false;
let hint = true;
const found = new Set<string>();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = r.width; H = r.height;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout = computeLayout(W, H, undefined, 12);
}
addEventListener('resize', () => { resize(); $('rotate').classList.toggle('hide', innerWidth >= innerHeight); });

const rnd = (i: number) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0; return h; };
const rrect = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

function drawBackground(t: number) {
  const p = stage.palette;
  let g = ctx.createLinearGradient(0, 0, 0, layout.stageH);
  g.addColorStop(0, '#0B0722'); g.addColorStop(0.5, p.sky); g.addColorStop(1, p.floor);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t / 900 + i))})`;
    ctx.beginPath(); ctx.arc(rnd(i) * W, rnd(i + 99) * layout.stageH * 0.6, 1 + (i % 3) * 0.6, 0, 7); ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    const x = W * (0.25 + i * 0.25);
    g = ctx.createLinearGradient(0, 0, 0, layout.stageH); g.addColorStop(0, p.glow + '33'); g.addColorStop(1, p.glow + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 6, 0); ctx.lineTo(x + 6, 0); ctx.lineTo(x + layout.size * 1.1, layout.stageH * 0.92); ctx.lineTo(x - layout.size * 1.1, layout.stageH * 0.92); ctx.fill();
  }
  const fy = layout.stageH * 0.93;
  g = ctx.createLinearGradient(0, fy - H * 0.2, 0, fy + H * 0.1); g.addColorStop(0, p.floor); g.addColorStop(1, p.floor);
  ctx.fillStyle = '#ffffff1f'; ctx.beginPath(); ctx.ellipse(W / 2, fy + H * 0.05, W * 0.55, H * 0.25, 0, 0, 7); ctx.fill();
  ctx.fillStyle = p.floor; ctx.beginPath(); ctx.ellipse(W / 2, fy + H * 0.055, W * 0.55, H * 0.25, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = p.glow + '40'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(W / 2, fy + H * 0.055, W * 0.55, H * 0.25, 0, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(8,5,26,0.92)'; ctx.fillRect(0, layout.tray.y, W, layout.tray.h);
  ctx.fillStyle = p.glow + '40'; ctx.fillRect(0, layout.tray.y, W, 2);
}

function badge(x: number, y: number, r: number, muted: boolean) {
  ctx.save();
  ctx.fillStyle = muted ? '#1B1340f2' : '#FFC857'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  if (muted) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - r * 0.55, y - r * 0.22); ctx.lineTo(x - r * 0.2, y - r * 0.22); ctx.lineTo(x + r * 0.2, y - r * 0.55); ctx.lineTo(x + r * 0.2, y + r * 0.55); ctx.lineTo(x - r * 0.2, y + r * 0.22); ctx.lineTo(x - r * 0.55, y + r * 0.22); ctx.fill();
    ctx.strokeStyle = '#FF6F91'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y + r * 0.6); ctx.lineTo(x + r * 0.6, y - r * 0.6); ctx.stroke();
  } else {
    ctx.fillStyle = '#7A4A00'; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.35 : r * 0.7; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.fill();
  }
  ctx.restore();
}

function poseIndex(cr: Creature, beat: number, t: number, muted: boolean): number {
  if (muted) return 3;
  if (blinkOpen(t + (hash(cr.id) % 3000), hash(cr.id)) < 0.5) return 2;
  return !reduceMotion && onsetPulse(cr.onsets, beat) > 0.3 ? 1 : 0;
}

function sprite(cr: Creature, pose: number, x: number, y: number, S: number, o: { sx?: number; sy?: number; lift?: number; tilt?: number; alpha?: number; grey?: boolean }) {
  if (!atlas) return;
  const i = stage.creatures.indexOf(cr);
  const k = S / SPRITE_S;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.grey) ctx.filter = 'grayscale(1) brightness(0.8)';
  ctx.translate(x, y - (o.lift ?? 0));
  ctx.rotate(o.tilt ?? 0);
  ctx.scale((o.sx ?? 1) * k, (o.sy ?? 1) * k);
  ctx.drawImage(atlas, pose * CELL_W, i * CELL_H, CELL_W, CELL_H, -FEET_X, -FEET_Y, CELL_W, CELL_H);
  ctx.restore();
}

function celebrationFx(t: number, beat: number) {
  if (!celebration) return;
  const b = beat - celebration.startBeat;
  if (b < 0) return;
  const f = Math.min(1, b / 2, Math.max(0, (32 - b) / 2));
  const cols = ['#FF7AA8', '#FFC857', '#5FE3C0', '#7A8CFF'];
  for (let i = 0; i < 5; i++) {
    const x = W * (0.1 + i * 0.2), a = Math.sin(t / 770 + i) * 0.35;
    const g = ctx.createLinearGradient(0, 0, 0, layout.stageH); g.addColorStop(0, cols[i % 4]! + '55'); g.addColorStop(1, cols[i % 4]! + '00');
    ctx.globalAlpha = f; ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 10 + Math.sin(a) * layout.stageH * 0.9 + layout.size * 0.5, layout.stageH); ctx.lineTo(x + Math.sin(a) * layout.stageH * 0.9 - layout.size * 0.5, layout.stageH); ctx.fill();
  }
  for (let i = 0; i < TUNING.confettiMax; i++) {
    const y = (((t / 1000) * (40 + rnd(i + 5) * 90) + rnd(i + 9) * layout.stageH * 1.4) % (layout.stageH * 1.15)) - 10;
    ctx.save(); ctx.globalAlpha = 0.9 * f; ctx.translate(rnd(i) * W + Math.sin(t / 500 + i) * 14, y); ctx.rotate((t / 5 + i * 40) % 360);
    ctx.fillStyle = cols[i % 4]!; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function frame(t: number) {
  requestAnimationFrame(frame);
  if (!session) return;
  const beat = engine.state === 'running' ? engine.positionBeats() : 0;
  drawBackground(t);
  const st = session.state;
  const l = layout;
  let target = -1;
  if (drags.length) { const d = drags[drags.length - 1]!; let best = Infinity; l.spots.forEach((p, i) => { const dist = Math.hypot(d.x - p.x, d.y - (p.y - l.size * 0.5)); if (dist < l.size * 0.62 && dist < best) { best = dist; target = i; } }); }
  const placedCount = st.spots.filter(Boolean).length;
  l.spots.forEach((p, i) => {
    if (i === target) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, l.size * 0.55); g.addColorStop(0, '#ffffffaa'); g.addColorStop(0.5, stage.palette.glow + '66'); g.addColorStop(1, '#00000000');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, l.size * 0.55, l.size * 0.14, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, l.size * 0.5, l.size * 0.11, 0, 0, 7); ctx.stroke();
      return;
    }
    ctx.strokeStyle = stage.palette.glow + (st.spots[i] ? '80' : '38'); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, l.size * 0.42, l.size * 0.07, 0, 0, 7); ctx.stroke();
    if (!st.spots[i] && placedCount < 3 && !drags.length) {
      const a = 0.3 + 0.2 * Math.sin(t / 500 + i), cy = p.y - l.size * 0.32, r = l.size * 0.09;
      ctx.strokeStyle = stage.palette.glow; ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x - r, cy); ctx.lineTo(p.x + r, cy); ctx.moveTo(p.x, cy - r); ctx.lineTo(p.x, cy + r); ctx.stroke(); ctx.globalAlpha = 1;
    }
  });
  if (st.solo) {
    const i = st.spots.indexOf(st.solo);
    if (i >= 0) {
      ctx.fillStyle = 'rgba(5,3,26,0.45)'; ctx.fillRect(0, 0, W, l.stageH);
      const f = l.spots[i]!;
      const g = ctx.createLinearGradient(0, 0, 0, f.y); g.addColorStop(0, stage.palette.glow + '55'); g.addColorStop(1, '#ffffff66');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(f.x - 8, 0); ctx.lineTo(f.x + 8, 0); ctx.lineTo(f.x + l.size * 0.9, f.y + 6); ctx.lineTo(f.x - l.size * 0.9, f.y + 6); ctx.fill();
    }
  }
  celebrationFx(t, beat);
  const order = st.spots.map((id, spot) => ({ id, spot })).filter((q): q is { id: string; spot: number } => !!q.id).sort((a, b) => l.spots[a.spot]!.y - l.spots[b.spot]!.y);
  for (const { id, spot } of order) {
    if (drags.some((d) => d.id === id)) continue;
    const cr = stage.creatures.find((c) => c.id === id)!;
    const to = l.spots[spot]!;
    const a = placedAnim.get(id);
    const age = a ? t - a.since : 1e9;
    const muted = !!st.muted[id];
    const dim = st.solo !== null && st.solo !== id;
    let x = to.x, y = to.y, sx = 1, sy = 1, lift = 0, tilt = 0;
    if (age < TUNING.hopMs && a && !reduceMotion) { const h = hop(a.from, to, age / TUNING.hopMs, l.size * 0.5); x = h.x; y = h.y; sx = h.sx; sy = h.sy; }
    else if (!muted && !reduceMotion) {
      const b = beatBounce(beat); sx = b.sx; sy = b.sy;
      lift = onsetPulse(cr.onsets, beat) * l.size * 0.07;
      sy *= 1 + 0.015 * breath(t, (hash(id) % 628) / 100);
    }
    if (celebration && celebration.creatureIds.includes(id) && !reduceMotion) { const k = celebration.creatureIds.indexOf(id); lift += Math.abs(Math.sin(beat * Math.PI + k * 0.5)) * l.size * 0.3; tilt = Math.sin(beat * Math.PI + k) * 0.12; }
    sprite(cr, poseIndex(cr, beat, t, muted), x, y, l.size, { sx, sy, lift, tilt, alpha: dim ? TUNING.soloDimOpacity : muted ? 0.45 : 1 });
    if (muted || st.solo === id) badge(x + l.size * 0.36, y - l.size * (cr.shape.body === 'tall' ? 1.1 : cr.shape.body === 'wide' ? 0.7 : 0.82), l.size * 0.12, muted);
  }
  // tray
  ctx.save(); ctx.beginPath(); ctx.rect(0, l.tray.y + 2, W, l.tray.h); ctx.clip();
  const per = stage.creatures.length / 4;
  for (let g = 0; g < 4; g++) {
    const a = l.slotPos[g * per]!, b = l.slotPos[g * per + per - 1]!;
    ctx.fillStyle = LAYER_COLORS[stage.creatures[g * per]!.layer] + '1c';
    rrect(a.x - l.slot * 0.55 - scrollX, l.tray.y + l.tray.h * 0.08, b.x - a.x + l.slot * 1.1, l.tray.h * 0.84, 14); ctx.fill();
  }
  const trayS = Math.min(l.slot * 0.85, l.tray.h * 0.56);
  stage.creatures.forEach((cr, i) => {
    const p = l.slotPos[i]!;
    const on = st.spots.includes(cr.id) || drags.some((d) => d.id === cr.id);
    sprite(cr, 0, p.x - scrollX, p.y + trayS * 0.55, trayS, { alpha: on ? 0.22 : 1, grey: on });
  });
  if (l.scrollMax > 0) {
    const fade = (x0: number, x1: number, a0: string, a1: string) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a0); g.addColorStop(1, a1); ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), l.tray.y + 2, 28, l.tray.h); };
    if (scrollX < l.scrollMax - 4) fade(W - 28, W, '#08051a00', '#08051acc');
    if (scrollX > 4) fade(28, 0, '#08051a00', '#08051acc');
  }
  ctx.restore();
  for (const r of returning) {
    const i = stage.creatures.findIndex((c) => c.id === r.id);
    const to = { x: l.slotPos[i]!.x - scrollX, y: l.slotPos[i]!.y + trayS * 0.55 };
    const k = Math.min(1, (t - r.since) / TUNING.hopMs), q = hop(r.from, to, k, l.size * 0.4);
    sprite(stage.creatures[i]!, 0, q.x, q.y, l.size * (1 - 0.25 * k), {});
  }
  returning = returning.filter((r) => t - r.since < TUNING.hopMs + 40);
  for (const d of drags) { const cr = stage.creatures.find((c) => c.id === d.id)!; sprite(cr, 1, d.x, d.y + l.size * 0.5, l.size * TUNING.dragLift, { tilt: 0.06 }); }
  if (hint && ready && drags.length === 0 && st.spots.every((s) => !s)) {
    const k = (t % 4000) / 4000, from = { x: l.slotPos[0]!.x - scrollX, y: l.slotPos[0]!.y }, to = { x: l.spots[2]!.x, y: l.spots[2]!.y - l.size * 0.4 };
    const m = Math.min(1, Math.max(0, (k - 0.15) / 0.55)), e = m * m * (3 - 2 * m);
    const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e - Math.sin(e * Math.PI) * l.size * 0.25;
    const fa = k < 0.08 ? k / 0.08 : k > 0.88 ? (1 - k) / 0.12 : 1;
    ctx.globalAlpha = fa; if (m > 0) sprite(stage.creatures[0]!, 1, x, y + l.size * 0.45, l.size * 0.9, { alpha: 0.85 });
    ctx.fillStyle = '#ffffffe6'; ctx.strokeStyle = '#FFC857'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i]!, k = (t - r.t) / 420;
    if (k >= 1) { ripples.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, 14 + 34 * k, 0, 7); ctx.stroke();
  }
  updateHud();
}

let lastHud = '';
let lastTip = -1;
const TIPS = ['Drag a singer from the tray up onto a glowing spot.', 'Nice! Add more singers. They always sound good together.', 'Tap a singer to mute it. Hold it to hear it solo. Drag it off to remove.', ''];
function updateHud() {
  if (!session) return;
  const n = session.state.spots.filter(Boolean).length;
  const tipIdx = n === 0 ? 0 : n < 3 ? 1 : n < 5 ? 2 : 3;
  if (tipIdx !== lastTip) { lastTip = tipIdx; $('tip').textContent = TIPS[tipIdx]!; $('tip').classList.toggle('hide', tipIdx === 3); }
  $('beat').style.transform = `scale(${1 + 0.6 * Math.max(0, 1 - ((engine.positionBeats() % 1) * 4))})`;
  const html = stage.combos.map((c) => {
    const on = new Set(session!.state.spots.filter((x): x is string => !!x).filter((x) => !session!.state.muted[x]));
    const n = session!.state.solo ? 0 : c.creatureIds.filter((id) => on.has(id)).length;
    const f = found.has(c.id);
    return `<span class="combo${f ? ' found' : ''}">${[0, 1, 2, 3].map((i) => `<i class="${f || i < n ? 'lit' : ''}"></i>`).join('')}</span>`;
  }).join('');
  if (html !== lastHud) { $('combos').innerHTML = html; lastHud = html; }
}

function world(): World { return { layout, scrollX, trayIds: stage.creatures.map((c) => c.id), onStage: session!.state.spots }; }
function apply(ev: GestureEvent, t: number) {
  const s = session!;
  const drop = (id: string) => (drags = drags.filter((d) => d.id !== id));
  const back = (id: string, from: { x: number; y: number }) => returning.push({ id, since: t, from });
  switch (ev.type) {
    case 'pickup': engine.playSfx('pickup'); drags = [...drags.filter((d) => d.id !== ev.creatureId), { id: ev.creatureId, x: ev.p.x, y: ev.p.y }]; break;
    case 'drag': drags = drags.map((d) => (d.id === ev.creatureId ? { ...d, x: ev.p.x, y: ev.p.y } : d)); break;
    case 'drop': {
      drop(ev.creatureId);
      const old = s.state.spots[ev.spot];
      if (old && old !== ev.creatureId) back(old, layout.spots[ev.spot]!);
      placedAnim.set(ev.creatureId, { since: t, from: { x: ev.p.x, y: ev.p.y + layout.size * 0.6 } });
      engine.playSfx('pop', popRate(stage.key, ev.spot));
      s.dispatch({ kind: 'drop', creatureId: ev.creatureId, spot: ev.spot });
      if (hint) { hint = false; s.countIn = false; }
      break;
    }
    case 'returnToTray': drop(ev.creatureId); back(ev.creatureId, { x: ev.p.x, y: ev.p.y + layout.size * 0.6 }); break;
    case 'remove': engine.playSfx('remove'); drop(ev.creatureId); back(ev.creatureId, { x: ev.p.x, y: ev.p.y + layout.size * 0.6 }); s.dispatch({ kind: 'remove', creatureId: ev.creatureId }); break;
    case 'tap': engine.playSfx(s.state.muted[ev.creatureId] ? 'unmute' : 'mute'); s.dispatch({ kind: 'mute', creatureId: ev.creatureId }); break;
    case 'longPress': s.dispatch({ kind: 'solo', creatureId: ev.creatureId }); break;
    case 'tapEmpty': s.dispatch({ kind: 'endSolo' }); break;
    case 'scroll': scrollX = ev.scrollX; break;
  }
}
function pt(e: PointerEvent) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
canvas.addEventListener('pointerdown', (e) => {
  if (!ready || !session) return;
  canvas.setPointerCapture(e.pointerId);
  const t = performance.now();
  ripples.push({ ...pt(e), t });
  tracker.start(e.pointerId, pt(e), Date.now(), world()).forEach((ev) => apply(ev, t));
  if (tracker.hasPendingLongPress) setTimeout(() => tracker.tick(Date.now()).forEach((ev) => apply(ev, performance.now())), TUNING.longPressMs + 10);
});
canvas.addEventListener('pointermove', (e) => { if (ready && session) tracker.move(e.pointerId, pt(e), Date.now(), world()).forEach((ev) => apply(ev, performance.now())); });
const up = (e: PointerEvent) => { if (ready && session) tracker.end(e.pointerId, pt(e), Date.now(), world()).forEach((ev) => apply(ev, performance.now())); };
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', (e) => { if (session) tracker.cancel(e.pointerId, world()).forEach((ev) => apply(ev, performance.now())); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

async function loadAtlas(id: string) {
  const img = new Image();
  img.src = `sprites/${id}.png`;
  await img.decode();
  atlas = img;
}

async function openStage(i: number) {
  ready = false;
  $('loading').classList.remove('hide');
  engine.stop();
  stageIdx = i; stage = STAGES[i]!;
  placedAnim.clear(); drags = []; returning = []; celebration = null; scrollX = 0; hint = true;
  lastTip = -1;
  document.querySelectorAll('#worlds button').forEach((b, k) => b.classList.toggle('on', k === i));
  await engine.init();
  await Promise.all([engine.loadStage(stage), loadAtlas(stage.id)]);
  session = new Session(stage, engine, {
    onCelebration: (id, bar) => { const c = stage.combos.find((q) => q.id === id)!; celebration = { comboId: id, creatureIds: [...c.creatureIds], startBeat: bar * 4 }; found.add(id); engine.playSfx('combo'); $('toast').classList.add('show'); setTimeout(() => $('toast').classList.remove('show'), 2500); },
    onCelebrationEnd: () => { celebration = null; },
  }, [...found]);
  session.countIn = true;
  session.start();
  ready = true;
  $('loading').classList.add('hide');
}

$('worlds').innerHTML = NAMES.map((n, i) => `<button data-i="${i}"><i class="wd" style="background:${STAGES[i]!.palette.accent}"></i><span class="long">${n}</span><span class="short">${n.split(' ')[0] === 'Sleepy' ? 'Clouds' : n.split(' ')[0] === 'Moonlit' ? 'Pond' : 'Fair'}</span></button>`).join('');
$('worlds').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (b) void openStage(Number(b.dataset.i)); });
$('clear').addEventListener('click', () => { if (!session) return; session.state.spots.forEach((id, s) => { if (id) returning.push({ id, since: performance.now(), from: layout.spots[s]! }); }); session.dispatch({ kind: 'clear' }); });
$('start').addEventListener('click', () => { $('splash').classList.add('hide'); void openStage(0); });
$('mute').addEventListener('click', () => { const on = engine.state === 'running'; if (on) engine.pause(); else engine.resume(); $('mute').setAttribute('aria-pressed', String(on)); $('mute').classList.toggle('off', on); });
resize();
$('rotate').classList.toggle('hide', innerWidth >= innerHeight);
requestAnimationFrame(frame);
void stageIdx;

// ---- combo book + how-to-play overlays ----
const cardsEl = $('cards');
function openBook() {
  if (!session) return;
  const s = session;
  const on = new Set(s.state.spots.filter((x): x is string => !!x).filter((x) => !s.state.muted[x]));
  cardsEl.innerHTML = '';
  stage.combos.forEach((c) => {
    const f = found.has(c.id);
    const card = document.createElement('div'); card.className = 'card';
    const cv = document.createElement('canvas'); cv.width = 4 * 150; cv.height = 170;
    const g = cv.getContext('2d')!;
    g.fillStyle = stage.palette.sky; g.fillRect(0, 0, cv.width, cv.height);
    if (atlas) c.creatureIds.forEach((id, i) => {
      const idx = stage.creatures.findIndex((q) => q.id === id);
      if (!f) g.filter = 'brightness(0) opacity(0.45)';
      g.drawImage(atlas!, 0, idx * CELL_H, CELL_W, CELL_H, i * 150 + 5, 0, 140, 153);
      g.filter = 'none';
    });
    const n = s.state.solo ? 0 : c.creatureIds.filter((id) => on.has(id)).length;
    const dots = document.createElement('div'); dots.className = 'combo' + (f ? ' found' : ''); dots.style.display = 'flex'; dots.style.gap = '6px';
    dots.innerHTML = [0, 1, 2, 3].map((i) => `<i class="${f || i < n ? 'lit' : ''}"></i>`).join('');
    card.append(cv, dots);
    if (f) { const b = document.createElement('button'); b.textContent = 'Replay show'; b.addEventListener('click', () => { $('book').classList.add('hide'); s.replayCombo(c.id); }); card.append(b); }
    cardsEl.append(card);
  });
  $('book').classList.remove('hide');
}
$('bookBtn').addEventListener('click', openBook);
$('book').addEventListener('click', (e) => { if (e.target === $('book') || (e.target as HTMLElement).closest('.x')) $('book').classList.add('hide'); });
let helpStep = 0;
function showHelp() {
  ($('helpImg') as HTMLImageElement).src = `help/${helpStep + 1}.png`;
  $('helpTxt').textContent = (en as Record<string, string>)[`help.step${helpStep + 1}`]!;
  $('hDots').innerHTML = Array.from({ length: 7 }, (_, i) => `<i class="${i === helpStep ? 'on' : ''}"></i>`).join('');
}
$('helpBtn').addEventListener('click', () => { helpStep = 0; showHelp(); $('help').classList.remove('hide'); });
$('hPrev').addEventListener('click', () => { helpStep = Math.max(0, helpStep - 1); showHelp(); });
$('hNext').addEventListener('click', () => { if (helpStep === 6) $('help').classList.add('hide'); else { helpStep++; showHelp(); } });
$('help').addEventListener('click', (e) => { if (e.target === $('help') || (e.target as HTMLElement).closest('.x')) $('help').classList.add('hide'); });
