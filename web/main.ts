// Playable web demo of Hummlings (Canvas 2D + Web Audio) using the real core logic and the real loops.
import { beatBounce, blinkOpen, breath, hop, onsetPulse } from '../src/core/anim';
import { GestureTracker, type GestureEvent, type World } from '../src/core/gestures';
import { computeLayout, popupRects, type Layout } from '../src/core/layout';
import { Session } from '../src/core/session';
import { TUNING } from '../src/core/tuning';
import { LAYER_COLORS, type Creature, type Stage } from '../src/core/types';
import { validateStage } from '../src/core/schema';
import pond from '../content/stages/1-pond.json';
import fair from '../content/stages/2-fair.json';
import clouds from '../content/stages/3-clouds.json';
import neon from '../content/stages/4-neon.json';
import frost from '../content/stages/5-frost.json';
import { WebEngine } from './engine';
import { en } from '../src/i18n/en';
import { popRate } from '../src/core/sfx';
import { randomBand } from '../src/core/surprise';
import { nextFreeSpot, type StageState } from '../src/core/stageState';
import { worldIconSvg } from '../src/core/worldIcons';
import { P } from './pictos';
import { autoName, comboStartsAt, stateAtBar, warnBars, type Song } from '../src/core/timeline';
import { songProvider } from '../src/core/session';
import { barSec } from '../src/core/tuning';
import { renderSong, samplesPerBar } from '../src/core/render';
import { encodeWav } from '../src/core/wav';

const STAGES: Stage[] = [pond, fair, clouds, neon, frost].map((r) => validateStage(r).stage!);
const NAMES = ['Moonlit Pond', 'Candy Fair', 'Sleepy Cloud Town', 'Neon City', 'Frosty Peaks'];
const SHORT = ['Pond', 'Fair', 'Clouds', 'Neon', 'Frost'];
const BODY_H = { round: 0.84, wide: 0.7, tall: 1.1, small: 0.74 } as const;
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
interface Particle { x: number; y: number; vx: number; vy: number; t: number; life: number; kind: 'note' | 'star' | 'spark'; color: string; size: number }
const particles: Particle[] = [];
let lastBeat = 0;
const spawn = (p: Particle) => { if (particles.length < 160) particles.push(p); };
const ripples2: { x: number; y: number; t: number }[] = [];
const ripples: { x: number; y: number; t: number }[] = [];
let popup: { spot: number; creatureId: string } | null = null;
let trayOpen = true;
let trayK = 1; // 1 = shown, 0 = tucked away (animated)
let playMode: { song: Song } | null = null;
let recording = false;
let ready = false;
let hint = true;
const store = { get: (k: string): string[] => { try { return JSON.parse(localStorage.getItem(k) ?? '[]') as string[]; } catch { return []; } }, set: (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } } };
const found = new Set<string>(store.get('hum.combos'));
const stickers = new Set<string>(store.get('hum.goals'));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = r.width; H = r.height;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout = computeLayout(W, H, undefined, 12, $('bar').offsetHeight + 4);
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
  if (muted) return 9;
  const sway = reduceMotion ? 1 : Math.sin((t + (hash(cr.id) % 1000)) / 170) > 0.35 ? 0 : Math.sin((t + (hash(cr.id) % 1000)) / 170) < -0.35 ? 2 : 1;
  const state = blinkOpen(t + (hash(cr.id) % 3000), hash(cr.id)) < 0.5 ? 2 : !reduceMotion && onsetPulse(cr.onsets, beat) > 0.3 ? 1 : 0;
  return state * 3 + sway;
}

function sprite(cr: Creature, pose: number, x: number, y: number, S: number, o: { level?: number; sx?: number; sy?: number; lift?: number; tilt?: number; alpha?: number; grey?: boolean }) {
  if (!atlas) return;
  if (o.level !== undefined && o.level < 0.995) { // volume as a fill level: colour up to the level, drained grey above it
    const lineY = y - (o.lift ?? 0) - o.level * BODY_H[cr.shape.body] * S;
    ctx.save(); ctx.beginPath(); ctx.rect(x - S * 1.6, y - S * 3.2, S * 3.2, lineY - (y - S * 3.2)); ctx.clip();
    sprite(cr, pose, x, y, S, { ...o, level: 1, alpha: (o.alpha ?? 1) * 0.3, grey: true });
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x - S * 1.6, lineY, S * 3.2, y + S - lineY); ctx.clip();
    sprite(cr, pose, x, y, S, { ...o, level: 1 });
    ctx.restore();
    if (o.level > 0.01) { ctx.strokeStyle = '#ffffff8c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - S * 0.4, lineY); ctx.lineTo(x + S * 0.4, lineY); ctx.stroke(); }
    return;
  }
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

/** Countdown to the secret combo's celebration: a gold ring that fills, the star pulses on the beat, seconds left underneath. */
function drawRewardRing(t: number, beat: number) {
  const rw = session?.reward;
  if (!rw || celebration || playMode) return;
  const total = Math.max(1, rw.startBeat - rw.fromBeat), left = Math.max(0, rw.startBeat - beat);
  const p = Math.min(1, Math.max(0, 1 - left / total)), secs = Math.ceil((left * 60) / stage.bpm);
  const cx = W / 2, cy = Math.max($('bar').offsetHeight + 56, H * 0.2), r = Math.max(30, layout.size * 0.26);
  const pulse = reduceMotion ? 0 : Math.max(0, 1 - (beat % 1) * 3);
  const g = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r + 16); g.addColorStop(0, `rgba(255,224,102,${0.25 + 0.5 * p})`); g.addColorStop(1, 'rgba(255,224,102,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r + 16 + pulse * 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#1B1340ee'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.strokeStyle = '#ffffff38'; ctx.beginPath(); ctx.arc(cx, cy, r - 5, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#FFC857'; ctx.beginPath(); ctx.arc(cx, cy, r - 5, -Math.PI / 2, -Math.PI / 2 + Math.max(0.02, p) * Math.PI * 2); ctx.stroke();
  const sr = r * (0.5 + 0.06 * pulse); ctx.fillStyle = '#FFE066'; ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, d = k % 2 ? sr * 0.42 : sr; ctx.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  ctx.fill();
  // bars left as dots (no digits): one dot per bar of the wait, lit as the bars pass
  const bars = Math.max(1, Math.round(total / 4)), done = Math.min(bars, Math.floor(bars - left / 4));
  const bw = bars * 20 + 14, by = cy + r + 16; ctx.fillStyle = '#1B1340f0'; ctx.beginPath(); ctx.roundRect(cx - bw / 2, by - 12, bw, 24, 12); ctx.fill(); ctx.strokeStyle = '#FFC857'; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < bars; i++) { ctx.fillStyle = i < done ? '#FFC857' : '#ffffff40'; ctx.beginPath(); ctx.arc(cx - bw / 2 + 17 + i * 20, by, 6.5, 0, 7); ctx.fill(); }
  void t; void secs;
}

function trayGlyph(layer: string, x: number, y: number, color: string) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath();
  if (layer === 'drums') { ctx.ellipse(x, y + 1, 10, 5, 0, 0, 7); ctx.moveTo(x - 7, y - 10); ctx.lineTo(x - 1, y - 2); ctx.moveTo(x + 7, y - 10); ctx.lineTo(x + 1, y - 2); ctx.stroke(); }
  else if (layer === 'bass') { ctx.moveTo(x - 11, y); ctx.bezierCurveTo(x - 7, y - 11, x - 2, y + 9, x + 1, y); ctx.bezierCurveTo(x + 4, y - 9, x + 8, y + 9, x + 12, y); ctx.stroke(); }
  else if (layer === 'melody') { ctx.arc(x - 4, y + 5, 4.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 0.5, y + 5); ctx.lineTo(x + 0.5, y - 10); ctx.lineTo(x + 9, y - 6); ctx.stroke(); }
  else { ctx.ellipse(x, y, 11, 8, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y + 3, 5, 3.4, 0, 0, 7); ctx.fill(); }
  ctx.restore();
}

function drawVolumeUi() {
  const s = session!, l = layout;
  if (popup && s.state.spots[popup.spot] !== popup.creatureId) popup = null;
  if (!popup) return;
  const r = popupRects(l, popup.spot), cr = stage.creatures.find((c) => c.id === popup!.creatureId)!;
  const vol = s.state.volume[cr.id] ?? 1, solo = s.state.solo === cr.id;
  ctx.fillStyle = '#1B1340f0'; ctx.beginPath(); ctx.roundRect(r.panel.x, r.panel.y, r.panel.w, r.panel.h, 18); ctx.fill();
  ctx.strokeStyle = '#ffffff4d'; ctx.lineWidth = 2; ctx.stroke();
  const cx = r.solo.x + r.solo.w / 2, cy = r.solo.y + r.solo.h / 2, rr = r.solo.w * 0.4;
  ctx.fillStyle = solo ? '#FFC857' : '#33276E'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill();
  ctx.fillStyle = solo ? '#7A4A00' : '#FFE066'; ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, d = k % 2 ? rr * 0.4 : rr * 0.78; ctx.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  ctx.fill();
  const tw = r.slider.w * 0.34, tx = r.slider.x + (r.slider.w - tw) / 2, fh = r.slider.h * vol;
  ctx.fillStyle = '#ffffff2e'; ctx.beginPath(); ctx.roundRect(tx, r.slider.y, tw, r.slider.h, tw / 2); ctx.fill();
  ctx.fillStyle = LAYER_COLORS[cr.layer]; ctx.beginPath(); ctx.roundRect(tx, r.slider.y + r.slider.h - fh, tw, fh, tw / 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r.slider.x + r.slider.w / 2, r.slider.y + r.slider.h - fh, r.slider.w * 0.3, 0, 7); ctx.fill();
  ctx.font = '800 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#FFE8A3'; ctx.fillText(`${Math.round(vol * 100)}%`, r.panel.x + r.panel.w / 2, r.panel.y + r.panel.h + 6); ctx.textAlign = 'start';
}

function drawParticles(t: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!, k = (t - p.t) / p.life;
    if (k >= 1) { particles.splice(i, 1); continue; }
    const x = p.x + p.vx * (t - p.t) / 1000 + (p.kind === 'note' ? Math.sin(k * 9) * 6 : 0), y = p.y + p.vy * (t - p.t) / 1000 + (p.kind === 'spark' ? 200 * ((t - p.t) / 1000) ** 2 : 0);
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.fillStyle = p.color; ctx.strokeStyle = p.color; ctx.translate(x, y);
    if (p.kind === 'note') {
      ctx.rotate(-0.3); ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.5, p.size * 0.36, 0, 0, 7); ctx.fill();
      ctx.lineWidth = Math.max(1.5, p.size * 0.12); ctx.beginPath(); ctx.moveTo(p.size * 0.46, 0); ctx.lineTo(p.size * 0.46, -p.size * 1.3); ctx.quadraticCurveTo(p.size * 0.9, -p.size, p.size * 0.9, -p.size * 0.6); ctx.stroke();
    } else if (p.kind === 'star') {
      ctx.rotate(k * 3); ctx.beginPath();
      for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j * Math.PI) / 5, rr = j % 2 ? p.size * 0.35 : p.size; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.fill();
    } else { ctx.beginPath(); ctx.arc(0, 0, p.size * (1 - k * 0.5), 0, 7); ctx.fill(); }
    ctx.restore();
  }
}

function burst(x: number, y: number, colors: string[], n: number, kind: 'star' | 'spark', t: number, speed = 160) {
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd(i + x) * 0.6, sp = speed * (0.5 + rnd(i + y)); spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t, life: 700 + rnd(i) * 500, kind, color: colors[i % colors.length]!, size: 4 + rnd(i + 3) * 5 }); }
}

function floorClip() { ctx.beginPath(); ctx.ellipse(W / 2, layout.stageH * 0.93 + H * 0.055, W * 0.55, H * 0.25, 0, 0, 7); ctx.clip(); }
function drawScenery(t: number) {
  const fy = layout.stageH * 0.93 + H * 0.055;
  ctx.save();
  if (stage.id === 'pond') {
    const mx = W * 0.82, my = H * 0.2, mr = H * 0.085;
    let g = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4); g.addColorStop(0, '#FFF6C855'); g.addColorStop(1, '#FFF6C800'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, mr * 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#FFF6D0'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill(); ctx.fillStyle = '#E8DFA8'; for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.13], [-0.1, 0.35, 0.1]] as const) { ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#5FE3C0aa'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const [x, hgt] of [[0.02, 0.2], [0.045, 0.28], [0.07, 0.18], [0.93, 0.22], [0.96, 0.3], [0.985, 0.16]] as const) { const bx = W * x, by = layout.stageH * 0.84; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + Math.sin(t / 900 + x * 9) * 6, by - H * hgt * 0.5, bx + 6, by - H * hgt); ctx.stroke(); ctx.fillStyle = '#8a5a3c'; ctx.beginPath(); ctx.ellipse(bx + 6, by - H * hgt, 3.2, 8, 0, 0, 7); ctx.fill(); }
    ctx.save(); floorClip(); ctx.strokeStyle = '#9fe8ff30'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) { const y = fy - H * 0.2 + i * H * 0.05; ctx.beginPath(); for (let x = 0; x <= W; x += 14) ctx.lineTo(x, y + Math.sin(x / 40 + t / 700 + i) * 2.2); ctx.stroke(); }
    g = ctx.createLinearGradient(mx, fy - H * 0.2, mx, fy + H * 0.05); g.addColorStop(0, '#FFF6C838'); g.addColorStop(1, '#FFF6C800'); ctx.fillStyle = g; ctx.fillRect(mx - mr * 0.5, fy - H * 0.2, mr, H * 0.3);
    ctx.restore();
  } else if (stage.id === 'fair') {
    const cx = W * 0.17, cy = layout.stageH * 0.46, R = H * 0.19, a0 = t / 9000;
    ctx.strokeStyle = '#FFD6E888'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, R * 0.12, 0, 7); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = a0 + (i * Math.PI) / 4, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = ['#FF7AA8', '#FFC857', '#5FE3C0', '#7A8CFF'][i % 4]! + 'dd'; ctx.beginPath(); ctx.roundRect(x - 8, y, 16, 13, 4); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(cx - R * 0.45, cy + R * 1.4); ctx.lineTo(cx, cy); ctx.lineTo(cx + R * 0.45, cy + R * 1.4); ctx.stroke();
    const tx = W * 0.83; for (let i = 0; i < 2; i++) { const x = tx + i * 70, w2 = 70; ctx.fillStyle = i ? '#FFC857aa' : '#FF7AA8aa'; ctx.beginPath(); ctx.moveTo(x - w2 / 2, layout.stageH * 0.55); ctx.lineTo(x, layout.stageH * 0.55 - 52); ctx.lineTo(x + w2 / 2, layout.stageH * 0.55); ctx.fill(); ctx.fillStyle = '#ffffff22'; ctx.fillRect(x - w2 / 2, layout.stageH * 0.55, w2, 26); }
    ctx.save(); floorClip(); for (let i = -12; i < 14; i++) { ctx.fillStyle = i % 2 ? '#ffffff12' : '#00000018'; ctx.beginPath(); ctx.moveTo(W / 2 + i * 60 - 20, fy - H * 0.25); ctx.lineTo(W / 2 + i * 60 + 40, fy - H * 0.25); ctx.lineTo(W / 2 + i * 90 + 70, fy + H * 0.3); ctx.lineTo(W / 2 + i * 90 - 20, fy + H * 0.3); ctx.fill(); } ctx.restore();
  } else if (stage.id === 'clouds') {
    const mx = W * 0.8, my = H * 0.22, mr = H * 0.08;
    ctx.fillStyle = '#FFF4D2'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill(); ctx.fillStyle = stage.palette.sky; ctx.beginPath(); ctx.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.9, 0, 7); ctx.fill();
    for (let i = 0; i < 6; i++) { const hx = W * (0.08 + i * 0.16) + (i % 2) * 14, hy = layout.stageH * 0.62, hw = 34 + (i % 3) * 8, hh = 26 + (i % 2) * 12; ctx.fillStyle = '#e8f6ffcc'; ctx.beginPath(); ctx.arc(hx, hy + 8, 30, 0, 7); ctx.arc(hx + 26, hy + 12, 24, 0, 7); ctx.arc(hx - 24, hy + 12, 22, 0, 7); ctx.fill(); ctx.fillStyle = '#FFE8A3'; ctx.fillRect(hx - hw / 2, hy - hh, hw, hh); ctx.fillStyle = '#7A8CFF'; ctx.beginPath(); ctx.moveTo(hx - hw / 2 - 4, hy - hh); ctx.lineTo(hx, hy - hh - 18); ctx.lineTo(hx + hw / 2 + 4, hy - hh); ctx.fill(); ctx.fillStyle = `rgba(255,170,60,${0.6 + 0.3 * Math.sin(t / 700 + i)})`; ctx.fillRect(hx - 4, hy - hh * 0.65, 8, 9); }
    ctx.save(); floorClip(); ctx.fillStyle = '#ffffff1c'; for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(W * (i / 17), fy - H * 0.17 + (i % 3) * 10, 26, 0, 7); ctx.fill(); } ctx.restore();
  } else if (stage.id === 'neon') {
    const hor = layout.stageH * 0.6;
    const cols = ['#FF4DD2', '#7DF9FF', '#FFE066', '#C8B6FF'];
    ctx.strokeStyle = '#FF4DD2'; ctx.lineWidth = 3; ctx.shadowColor = '#FF4DD2'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.2, H * 0.075, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
    for (let i = 0; i < 13; i++) {
      const bw = W * (0.045 + ((i * 37) % 5) * 0.008), bx = W * (i / 13) + 4, bh = layout.stageH * (0.22 + ((i * 53) % 7) * 0.05);
      ctx.fillStyle = '#0d1530'; ctx.fillRect(bx, hor - bh, bw, bh);
      ctx.strokeStyle = cols[i % 4]! + '66'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, hor - bh, bw, bh);
      for (let wy = 0; wy < bh - 10; wy += 14) for (let wx = 5; wx < bw - 8; wx += 11) { const on = Math.sin(i * 7.3 + wy * 0.9 + wx * 1.7 + Math.floor(t / 1800)) > 0.2; ctx.fillStyle = on ? cols[(i + wy) % 4]! + 'cc' : '#ffffff10'; ctx.fillRect(bx + wx, hor - bh + wy + 6, 5, 6); }
    }
    ctx.save(); ctx.font = '800 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.shadowColor = '#7DF9FF'; ctx.shadowBlur = 12 + 6 * Math.sin(t / 220); ctx.fillStyle = '#7DF9FF'; ctx.fillText('HUM', W * 0.12, layout.stageH * 0.3); ctx.restore();
    ctx.save(); floorClip(); ctx.strokeStyle = '#7DF9FF40'; ctx.lineWidth = 1.5;
    for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 14, fy - H * 0.2); ctx.lineTo(W / 2 + i * 120, fy + H * 0.3); ctx.stroke(); }
    for (let k = 0; k < 8; k++) { const u = ((k + (t / 1800) % 1) / 8) ** 2; ctx.beginPath(); ctx.moveTo(0, fy - H * 0.2 + u * H * 0.5); ctx.lineTo(W, fy - H * 0.2 + u * H * 0.5); ctx.stroke(); }
    ctx.restore();
  } else if (stage.id === 'frost') {
    for (let k = 0; k < 3; k++) { // aurora ribbons
      ctx.beginPath(); ctx.moveTo(0, layout.stageH * (0.18 + k * 0.07));
      for (let x = 0; x <= W; x += 24) ctx.lineTo(x, layout.stageH * (0.16 + k * 0.07) + Math.sin(x / 130 + t / 1600 + k * 2) * 18);
      for (let x = W; x >= 0; x -= 24) ctx.lineTo(x, layout.stageH * (0.3 + k * 0.07) + Math.sin(x / 110 + t / 1400 + k) * 22);
      ctx.closePath(); const g = ctx.createLinearGradient(0, 0, 0, layout.stageH * 0.55); g.addColorStop(0, ['#5FE3C055', '#9AD7FF44', '#C8B6FF44'][k]!); g.addColorStop(1, '#00000000'); ctx.fillStyle = g; ctx.fill();
    }
    for (const [x0, w2, hh, col] of [[-0.05, 0.4, 0.34, '#2c5a86'], [0.25, 0.5, 0.42, '#3a6c9c'], [0.62, 0.45, 0.3, '#2c5a86'], [0.8, 0.4, 0.38, '#3a6c9c']] as const) {
      const bx = W * x0, bw = W * w2, base = layout.stageH * 0.64, top = base - layout.stageH * hh;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx, base); ctx.lineTo(bx + bw / 2, top); ctx.lineTo(bx + bw, base); ctx.fill();
      ctx.fillStyle = '#EAF6FF'; ctx.beginPath(); ctx.moveTo(bx + bw / 2, top); ctx.lineTo(bx + bw * 0.4, top + (base - top) * 0.28); ctx.lineTo(bx + bw * 0.5, top + (base - top) * 0.22); ctx.lineTo(bx + bw * 0.6, top + (base - top) * 0.3); ctx.fill();
    }
    ctx.save(); floorClip(); ctx.fillStyle = '#ffffff22'; ctx.fillRect(0, fy - H * 0.2, W, H * 0.5);
    for (let i = 0; i < 30; i++) { ctx.fillStyle = '#ffffff44'; ctx.beginPath(); ctx.arc(rnd(i + 200) * W, fy - H * 0.18 + rnd(i + 300) * H * 0.3, 1.5, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}

function drawDecor(t: number, beat: number) {
  const p = stage.palette;
  drawScenery(t);
  ctx.save();
  if (stage.id === 'pond') { // lily pads, ripples and fireflies
    for (let i = 0; i < 4; i++) { const x = W * (0.12 + i * 0.26), y = layout.stageH * (0.88 + 0.03 * (i % 2)); ctx.fillStyle = '#2c6f6a99'; ctx.beginPath(); ctx.ellipse(x, y, 30, 8, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#7fe3c455'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, 30 + ((t / 40 + i * 20) % 30), 8 + ((t / 120 + i * 6) % 8), 0, 0, 7); ctx.stroke(); }
    for (let i = 0; i < 14; i++) { const x = rnd(i + 40) * W + Math.sin(t / 1300 + i) * 18, y = layout.stageH * (0.15 + rnd(i + 70) * 0.55) + Math.cos(t / 1700 + i) * 12; ctx.fillStyle = `rgba(255,248,170,${0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t / 400 + i * 2))})`; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
  } else if (stage.id === 'fair') { // bunting and balloons
    ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 18); ctx.quadraticCurveTo(W / 2, 70, W, 18); ctx.stroke();
    const cols = ['#FF7AA8', '#FFC857', '#5FE3C0', '#7A8CFF'];
    for (let i = 0; i < 14; i++) { const u = (i + 0.5) / 14, x = W * u, y = 18 + 52 * 4 * u * (1 - u) * 0.5 + 6; ctx.fillStyle = cols[i % 4] + 'cc'; ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 20 + 2 * Math.sin(t / 300 + i)); ctx.fill(); }
    for (let i = 0; i < 5; i++) { const x = W * (0.08 + i * 0.21) + Math.sin(t / 1500 + i) * 10, y = layout.stageH * (0.3 + 0.08 * Math.sin(t / 1100 + i * 2)); ctx.strokeStyle = '#ffffff44'; ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x, y + 70); ctx.stroke(); ctx.fillStyle = cols[(i + 1) % 4] + 'aa'; ctx.beginPath(); ctx.ellipse(x, y, 13, 17, 0, 0, 7); ctx.fill(); }
  } else if (stage.id === 'clouds') { // drifting clouds
    for (let i = 0; i < 5; i++) { const x = ((t / 40 + i * W * 0.25) % (W * 1.3)) - W * 0.15, y = layout.stageH * (0.12 + 0.12 * i % 0.5); ctx.fillStyle = '#d6f0ff22'; for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 28], [52, 0, 22], [26, 8, 24]] as const) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 7); ctx.fill(); } }
  } else if (stage.id === 'neon') { // neon rain
    ctx.strokeStyle = '#7DF9FF55'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 46; i++) { const x = rnd(i + 400) * W, y = ((t / 3 * (0.6 + rnd(i + 500)) + rnd(i + 600) * layout.stageH * 2) % (layout.stageH * 1.2)) - 10; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 13); ctx.stroke(); }
  } else if (stage.id === 'frost') { // snowfall
    ctx.fillStyle = '#ffffffcc';
    for (let i = 0; i < 70; i++) { const x = (rnd(i + 700) * W + Math.sin(t / 900 + i) * 14 + W) % W, y = ((t / 12 * (0.4 + rnd(i + 800)) + rnd(i + 900) * layout.stageH * 2) % (layout.stageH * 1.15)) - 6; ctx.beginPath(); ctx.arc(x, y, 1.2 + rnd(i + 1000) * 2, 0, 7); ctx.fill(); }
  }
  // the floor rim breathes with the beat
  ctx.strokeStyle = p.glow + Math.round(40 + 90 * Math.max(0, 1 - (beat % 1) * 3)).toString(16).padStart(2, '0'); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(W / 2, layout.stageH * 0.93 + H * 0.055, W * 0.55, H * 0.25, 0, 0, 7); ctx.stroke();
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
  drawDecor(t, beat);
  const st = session.state;
  const l = layout;
  let target = -1;
  if (drags.length) { const d = drags[drags.length - 1]!; let best = Infinity; l.spots.forEach((p, i) => { const dist = Math.hypot(d.x - p.x, d.y - (p.y - l.size * 0.5)); if (dist < l.size * 0.62 && dist < best) { best = dist; target = i; } }); }
  const placedCount = st.spots.filter(Boolean).length;
  if (!reduceMotion && beat > lastBeat && beat - lastBeat < 2) {
    for (const id of st.spots) {
      if (!id || st.muted[id] || (st.solo && st.solo !== id)) continue;
      const cr = stage.creatures.find((c) => c.id === id)!;
      const loop = beat % 16, prev = lastBeat % 16;
      if (cr.onsets.some((o) => (prev <= loop ? o > prev && o <= loop : o > prev || o <= loop)) && cr.layer !== 'drums' && rnd(Math.floor(beat * 4) + hash(id)) < 0.6) {
        const sp = l.spots[st.spots.indexOf(id)]!;
        spawn({ x: sp.x + (rnd(beat) - 0.5) * l.size * 0.5, y: sp.y - l.size * 1.0, vx: (rnd(beat + 3) - 0.5) * 30, vy: -55, t, life: 1500, kind: 'note', color: LAYER_COLORS[cr.layer], size: 8 + l.size * 0.04 });
      }
    }
  }
  if (celebration && Math.floor(beat) !== Math.floor(lastBeat) && beat - celebration.startBeat >= 0 && beat - celebration.startBeat < 32) burst(W * (0.15 + rnd(Math.floor(beat)) * 0.7), l.stageH * (0.12 + rnd(Math.floor(beat) + 5) * 0.4), ['#FF7AA8', '#FFC857', '#5FE3C0', '#7A8CFF', '#FFFFFF'], 18, 'spark', t, 200);
  lastBeat = beat;
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
    sprite(cr, poseIndex(cr, beat, t, muted), x, y, l.size, { sx, sy, lift, tilt, level: st.volume[id], alpha: dim ? TUNING.soloDimOpacity : muted ? 0.45 : 1 });
    if (muted || st.solo === id) badge(x + l.size * 0.36, y - l.size * (cr.shape.body === 'tall' ? 1.1 : cr.shape.body === 'wide' ? 0.7 : 0.82), l.size * 0.12, muted);
  }
  // tray (the singer menu): slides down out of view on a downward swipe, and back with the handle
  trayK += ((trayOpen ? 1 : 0) - trayK) * 0.22;
  if (Math.abs((trayOpen ? 1 : 0) - trayK) < 0.002) trayK = trayOpen ? 1 : 0;
  const trayDy = (1 - trayK) * (l.tray.h + 6);
  ctx.save(); ctx.translate(0, trayDy);
  ctx.fillStyle = 'rgba(8,5,26,0.94)'; ctx.fillRect(0, l.tray.y, W, l.tray.h + 6);
  ctx.fillStyle = stage.palette.glow + '40'; ctx.fillRect(0, l.tray.y, W, 2);
  ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.roundRect(W / 2 - 24, l.tray.y + 5, 48, 5, 2.5); ctx.fill(); // grab bar: swipe down to tuck the menu away
  ctx.save(); ctx.beginPath(); ctx.rect(0, l.tray.y + 2, W, l.tray.h); ctx.clip();
  const per = stage.creatures.length / 4;
  for (let g = 0; g < 4; g++) {
    const a = l.slotPos[g * per]!, b = l.slotPos[g * per + per - 1]!;
    ctx.fillStyle = LAYER_COLORS[stage.creatures[g * per]!.layer] + '1c';
    rrect(a.x - l.slot * 0.55 - scrollX, l.tray.y + l.tray.h * 0.08, b.x - a.x + l.slot * 1.1, l.tray.h * 0.84, 14); ctx.fill();
  }
  for (let g = 0; g < 4; g++) {
    const a = l.slotPos[g * per]!, layer = stage.creatures[g * per]!.layer;
    // caption sits at the group's left edge (sticky while scrolling) but never leaves its own group, so two captions never overlap
    const b2 = l.slotPos[g * per + per - 1]!, gL = a.x - l.slot * 0.55 - scrollX, gR = b2.x + l.slot * 0.55 - scrollX;
    const cap = 112, gx = Math.min(Math.max(gL + 22, 22), gR - cap), gy = l.tray.y + 20;
    if (gR - gL < cap + 10 || gR < 0 || gL > W) continue;
    trayGlyph(layer, gx, gy, LAYER_COLORS[layer]);
    ctx.font = '700 14px system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = LAYER_COLORS[layer]; ctx.fillText(LAYER_NAMES[layer].toUpperCase(), gx + 20, gy);
  }
  const trayS = Math.min(l.slot * 0.85, (l.tray.h - 36) / 1.4); // leaves a caption row above the tallest singer
  stage.creatures.forEach((cr, i) => {
    const p = l.slotPos[i]!;
    const on = st.spots.includes(cr.id) || drags.some((d) => d.id === cr.id);
    sprite(cr, 1, p.x - scrollX, l.tray.y + l.tray.h - 10, trayS, { alpha: on ? 0.22 : 1, grey: on });
  });
  if (l.scrollMax > 0) {
    const fade = (x0: number, x1: number, a0: string, a1: string) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a0); g.addColorStop(1, a1); ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), l.tray.y + 2, 28, l.tray.h); };
    if (scrollX < l.scrollMax - 4) fade(W - 28, W, '#08051a00', '#08051acc');
    if (scrollX > 4) fade(28, 0, '#08051a00', '#08051acc');
  }
  ctx.restore();
  ctx.restore(); // end of the sliding tray
  if (trayK < 0.98) { // handle tab at the bottom edge while the menu is hidden
    const hw = 84, hy = H - 34 * (1 - trayK);
    ctx.fillStyle = '#1B1340f2'; ctx.beginPath(); ctx.roundRect(W / 2 - hw / 2, hy, hw, 40, 14); ctx.fill();
    ctx.strokeStyle = '#ffffff80'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(W / 2 - 12, hy + 20); ctx.lineTo(W / 2, hy + 10); ctx.lineTo(W / 2 + 12, hy + 20); ctx.stroke();
  }
  for (const r of returning) {
    const i = stage.creatures.findIndex((c) => c.id === r.id);
    const to = { x: l.slotPos[i]!.x - scrollX, y: l.tray.y + l.tray.h - 10 + trayDy };
    const k = Math.min(1, (t - r.since) / TUNING.hopMs), q = hop(r.from, to, k, l.size * 0.4);
    sprite(stage.creatures[i]!, 1, q.x, q.y, l.size * (1 - 0.25 * k), {});
  }
  returning = returning.filter((r) => t - r.since < TUNING.hopMs + 40);
  for (const d of drags) { const cr = stage.creatures.find((c) => c.id === d.id)!; sprite(cr, 4, d.x, d.y + l.size * 0.5, l.size * TUNING.dragLift, { tilt: 0.06 }); }
  if (hint && ready && drags.length === 0 && st.spots.every((s) => !s)) {
    const k = (t % 4000) / 4000, from = { x: l.slotPos[0]!.x - scrollX, y: l.slotPos[0]!.y }, to = { x: l.spots[2]!.x, y: l.spots[2]!.y - l.size * 0.4 };
    const m = Math.min(1, Math.max(0, (k - 0.15) / 0.55)), e = m * m * (3 - 2 * m);
    const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e - Math.sin(e * Math.PI) * l.size * 0.25;
    const fa = k < 0.08 ? k / 0.08 : k > 0.88 ? (1 - k) / 0.12 : 1;
    ctx.globalAlpha = fa; if (m > 0) sprite(stage.creatures[0]!, 4, x, y + l.size * 0.45, l.size * 0.9, { alpha: 0.85 });
    ctx.fillStyle = '#ffffffcc'; ctx.strokeStyle = '#FFC857'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  }
  drawVolumeUi();
  drawRewardRing(t, beat);
  drawParticles(t);
  for (let i = ripples2.length - 1; i >= 0; i--) { const r = ripples2[i]!, k = (t - r.t) / 1100; if (k >= 1) { ripples2.splice(i, 1); continue; } if (k < 0) continue; ctx.strokeStyle = `rgba(180,240,255,${0.7 * (1 - k)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(r.x, r.y, 10 + 90 * k, (10 + 90 * k) * 0.35, 0, 0, 7); ctx.stroke(); }
  // banner for a found combo
  if (celebration && beat - celebration.startBeat >= 0 && beat - celebration.startBeat < 6) {
    const k = beat - celebration.startBeat, sc = Math.min(1, k * 2) * (1 + 0.05 * Math.sin(k * 6));
    ctx.save(); ctx.translate(W / 2, layout.stageH * 0.3); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, (6 - k) / 1.5);
    ctx.font = '800 38px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = '#1B1340'; ctx.strokeText('SECRET COMBO!', 0, 0); ctx.fillStyle = '#FFE066'; ctx.fillText('SECRET COMBO!', 0, 0); ctx.restore();
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i]!, k = (t - r.t) / 420;
    if (k >= 1) { ripples.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, 14 + 34 * k, 0, 7); ctx.stroke();
  }
  updateHud();
}

let lastHud = '';


let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(html: string) { const el = $('toast'); el.innerHTML = html; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
const GOAL_PICTO: Record<string, (s: number) => string> = {
  fullBand: (s) => (['drums', 'bass', 'melody', 'voice'] as const).map((l) => `<span style="color:${LAYER_COLORS[l]}">${GLYPH[l].replace('<svg ', `<svg width="${s}" height="${s}" `)}</span>`).join(''),
  drumCircle: (s) => [0, 1, 2].map(() => `<span style="color:${LAYER_COLORS.drums}">${GLYPH.drums.replace('<svg ', `<svg width="${s}" height="${s}" `)}</span>`).join(''),
  choir: (s) => [0, 1, 2].map(() => `<span style="color:${LAYER_COLORS.voice}">${GLYPH.voice.replace('<svg ', `<svg width="${s}" height="${s}" `)}</span>`).join(''),
  fullStage: (s) => `<span class="dd">${Array.from({ length: 6 }, () => `<i style="background:#fff;width:${s * 0.45}px;height:${s * 0.45}px"></i>`).join('')}</span>`,
  soloist: (s) => `${P.star(s)}${(['drums', 'bass', 'melody', 'voice'] as const).map((l) => `<span style="color:${LAYER_COLORS[l]}">${GLYPH[l].replace('<svg ', `<svg width="${s * 0.8}" height="${s * 0.8}" `)}</span>`).join('')}`,
  mixMaster: (s) => `${P.speakerOff(s)}${P.speaker(s)}${P.speakerOff(s)}`,
  swapper: (s) => P.swipe(s),
  twoCombos: (s) => `${P.book(s)}${P.star(s * 0.8)}${P.star(s * 0.8)}`,
};
const LAYER_ORDER = ['drums', 'bass', 'melody', 'voice'] as const;
const LAYER_NAMES = { drums: 'Drums', bass: 'Bass', melody: 'Melody', voice: 'Voice' } as const;
const GLYPH = {
  drums: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="8" ry="4"/><path d="M4 13v4c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5v-4M8 4l4 6M16 4l-4 6"/></svg>',
  bass: '<svg viewBox="0 0 24 24"><path d="M3 12c3-6 6 6 9 0s6 6 9 0"/></svg>',
  melody: '<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/></svg>',
  voice: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="7" ry="5.5"/><path d="M9 11.5h.01M15 11.5h.01"/><ellipse cx="12" cy="16" rx="2.6" ry="1.8"/></svg>',
} as const;
let lastBand = '';
function updateHud() {
  if (!session) return;
  $('beat').style.transform = `scale(${1 + 0.6 * Math.max(0, 1 - ((engine.positionBeats() % 1) * 4))})`;
  const live = new Set(session.state.solo ? [session.state.solo] : session.state.spots.filter((x): x is string => !!x && !session!.state.muted[x]));
  const band = LAYER_ORDER.map((l) => (stage.creatures.some((c) => c.layer === l && live.has(c.id)) ? '1' : '0')).join('');
  if (band !== lastBand) { lastBand = band; $('band').innerHTML = LAYER_ORDER.map((l, i) => `<b class="${band[i] === '1' ? 'on' : ''}" style="--c:${LAYER_COLORS[l]}" title="${LAYER_NAMES[l]}: ${band[i] === '1' ? 'playing' : 'not playing'}"><i>${GLYPH[l]}</i>${LAYER_NAMES[l]}</b>`).join(''); }
  const on = new Set(session.state.spots.filter((x): x is string => !!x).filter((x) => !session!.state.muted[x] && (session!.state.volume[x] ?? 1) >= 0.03));
  const cnt = (c: (typeof stage.combos)[number]) => (session!.state.solo ? 0 : c.creatureIds.filter((id) => on.has(id)).length);
  const open = stage.combos.filter((c) => !found.has(c.id));
  const best = open.sort((x, y) => cnt(y) - cnt(x))[0];
  const nFound = stage.combos.length - open.length;
  const html = best
    ? `<span class="combo" title="Closest secret combo">${[0, 1, 2, 3].map((i) => `<i class="${i < cnt(best) ? 'lit' : ''}"></i>`).join('')}</span><span class="fnd" title="Combos found"><small>${nFound}/${stage.combos.length}</small>${Array.from({ length: stage.combos.length }, (_, i) => P.star(16, i < nFound ? '#FFE066' : '#ffffff33')).join('')}</span>`
    : `<span class="fnd">${Array.from({ length: stage.combos.length }, () => P.star(18)).join('')}</span>`;
  if (html !== lastHud) { $('combos').innerHTML = html; lastHud = html; }
}

function world(): World { return { layout, scrollX, trayIds: stage.creatures.map((c) => c.id), onStage: session!.state.spots, popup, volumeOf: (id) => session!.state.volume[id] ?? 1, trayHidden: !trayOpen }; }
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
      burst(layout.spots[ev.spot]!.x, layout.spots[ev.spot]!.y - layout.size * 0.3, [stage.palette.glow, '#FFFFFF', '#FF7AA8'], 10, 'star', t);
      s.dispatch({ kind: 'drop', creatureId: ev.creatureId, spot: ev.spot });
      if (hint) { hint = false; s.countIn = false; }
      break;
    }
    case 'returnToTray': drop(ev.creatureId); back(ev.creatureId, { x: ev.p.x, y: ev.p.y + layout.size * 0.6 }); break;
    case 'remove': engine.playSfx('remove'); drop(ev.creatureId); back(ev.creatureId, { x: ev.p.x, y: ev.p.y + layout.size * 0.6 }); s.dispatch({ kind: 'remove', creatureId: ev.creatureId }); break;
    case 'tap': engine.playSfx(s.state.muted[ev.creatureId] ? 'unmute' : 'mute'); s.dispatch({ kind: 'mute', creatureId: ev.creatureId }); break;
    case 'longPress': { const spot = s.state.spots.indexOf(ev.creatureId); if (spot >= 0) popup = { spot, creatureId: ev.creatureId }; engine.playSfx('pickup'); break; }
    case 'volumeSet': s.dispatch({ kind: 'volume', creatureId: ev.creatureId, value: ev.value }); break;
    case 'popupSolo': s.dispatch({ kind: 'solo', creatureId: ev.creatureId }); engine.playSfx('pop', 1.5); break;
    case 'trayTap': {
      const spot = nextFreeSpot(s.state), i = stage.creatures.findIndex((c) => c.id === ev.creatureId);
      if (spot < 0 || i < 0) { engine.playSfx('mute'); break; }
      apply({ type: 'drop', touch: -1, creatureId: ev.creatureId, spot, p: { x: layout.slotPos[i]!.x - scrollX, y: layout.slotPos[i]!.y - layout.size * 0.6 } }, t);
      break;
    }
    case 'popupClose': popup = null; break;
    case 'trayHide': trayOpen = false; break;
    case 'trayShow': trayOpen = true; break;
    case 'tapEmpty': {
      s.dispatch({ kind: 'endSolo' });
      if (ev.p.y < layout.stageH) { // the world's own toy: tapping the scenery plays a note of the scale
        const deg = Math.max(0, Math.min(5, Math.floor((ev.p.x / W) * 6)));
        engine.playSfx('pop', popRate(stage.key, deg) * 2);
        if (stage.id === 'pond') for (let k = 0; k < 3; k++) ripples2.push({ x: ev.p.x, y: ev.p.y, t: t + k * 160 });
        else if (stage.id === 'fair') burst(ev.p.x, ev.p.y, ['#FF7AA8', '#FFC857', '#5FE3C0', '#7A8CFF'], 14, 'spark', t, 230);
        else if (stage.id === 'neon') { burst(ev.p.x, ev.p.y, ['#7DF9FF', '#FF4DD2', '#FFE066'], 16, 'spark', t, 260); for (let k = 0; k < 2; k++) ripples2.push({ x: ev.p.x, y: ev.p.y, t: t + k * 140 }); }
        else if (stage.id === 'frost') burst(ev.p.x, ev.p.y, ['#FFFFFF', '#9AD7FF', '#E8F6FF'], 12, 'star', t, 110);
        else burst(ev.p.x, ev.p.y, ['#FFFFFF', '#D6F0FF', '#FFE8A3'], 8, 'star', t, 90);
      }
      break;
    }
    case 'scroll': scrollX = ev.scrollX; break;
  }
}
function pt(e: PointerEvent) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
canvas.addEventListener('pointerdown', (e) => {
  if (!ready || !session || playMode) return;
  canvas.setPointerCapture(e.pointerId);
  const t = performance.now();
  ripples.push({ ...pt(e), t });
  tracker.start(e.pointerId, pt(e), Date.now(), world()).forEach((ev) => apply(ev, t));
  if (tracker.hasPendingLongPress) setTimeout(() => tracker.tick(Date.now(), world()).forEach((ev) => apply(ev, performance.now())), TUNING.longPressMs + 10);
});
canvas.addEventListener('pointermove', (e) => { if (ready && session && !playMode) tracker.move(e.pointerId, pt(e), Date.now(), world()).forEach((ev) => apply(ev, performance.now())); });
const up = (e: PointerEvent) => { if (ready && session && !playMode) tracker.end(e.pointerId, pt(e), Date.now(), world()).forEach((ev) => apply(ev, performance.now())); };
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
  session = null; // the frame loop pauses until the new world is ready
  $('loading').innerHTML = `${worldIconSvg(STAGES[i]!.id, 84)}<span class="spin"></span>`;
  $('loading').classList.remove('hide');
  engine.stop();
  stageIdx = i; stage = STAGES[i]!;
  placedAnim.clear(); drags = []; returning = []; celebration = null; scrollX = 0; hint = true;
  document.querySelectorAll('#worlds button').forEach((b, k) => b.classList.toggle('on', k === i));
  await engine.init();
  await Promise.all([engine.loadStage(stage), loadAtlas(stage.id)]);
  session = new Session(stage, engine, {
    onCelebration: (id, bar) => { const c = stage.combos.find((q) => q.id === id)!; celebration = { comboId: id, creatureIds: [...c.creatureIds], startBeat: bar * 4 }; found.add(id); store.set('hum.combos', [...found]); engine.playSfx('combo'); toast(`${P.star(30)}${P.book(30)}<span>Secret combo!</span>`); },
    onCelebrationEnd: () => { celebration = null; },
    onGoal: (key) => { stickers.add(key); store.set('hum.goals', [...stickers]); engine.playSfx('goal'); toast(`${P.sticker(30)}${GOAL_PICTO[key.split(':')[1]!]?.(24) ?? ''}<span>${(en as Record<string, string>)['goal.' + key.split(':')[1]]}</span>`); burst(W / 2, H * 0.3, ['#FFC857', '#FFFFFF', '#5FE3C0'], 16, 'star', performance.now(), 220); },
  }, [...found], [...stickers]);
  session.countIn = true;
  session.start();
  ready = true;
  $('loading').classList.add('hide');
}

$('worlds').innerHTML = NAMES.map((n, i) => `<button data-i="${i}" aria-label="${n}" title="${n}"><span class="wi">${worldIconSvg(STAGES[i]!.id, 32)}</span><span class="long">${n}</span><span class="short">${SHORT[i]}</span></button>`).join('');
$('worlds').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (b) void openStage(Number(b.dataset.i)); });
$('dice').addEventListener('click', () => {
  if (!session || !ready) return;
  const s = session;
  rememberForUndo();
  s.state.spots.forEach((id, sp) => { if (id) returning.push({ id, since: performance.now(), from: layout.spots[sp]! }); });
  s.dispatch({ kind: 'clear' });
  const now = performance.now();
  randomBand(stage).forEach((id, spot) => {
    const i = stage.creatures.findIndex((c) => c.id === id);
    placedAnim.set(id, { since: now + spot * 90, from: { x: layout.slotPos[i]!.x - scrollX, y: layout.slotPos[i]!.y } });
    s.dispatch({ kind: 'drop', creatureId: id, spot });
  });
  hint = false; engine.playSfx('goal');
});
$('clear').addEventListener('click', () => { if (!session) return; rememberForUndo(); session.state.spots.forEach((id, s) => { if (id) returning.push({ id, since: performance.now(), from: layout.spots[s]! }); }); session.dispatch({ kind: 'clear' }); });
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
  const gs = document.createElement('div'); gs.className = 'goals';
  gs.innerHTML = `<h3>${P.sticker(26)} ${(en as Record<string, string>)['goal.title']}</h3>` + s.goals.progress(s.state, s.discoveredInStage).map((g) => {
    const d = stickers.has(`${stage.id}:${g.id}`);
    return `<div class="goal${d ? ' done' : ''}"><span class="gp">${GOAL_PICTO[g.id]!(30)}</span><span class="gt"><b>${(en as Record<string, string>)['goal.' + g.id]}</b><small>${(en as Record<string, string>)['goal.' + g.id + '.desc']}</small></span>${P.dots(d ? g.total : g.n, g.total)}${d ? P.star(24) : ''}</div>`;
  }).join('');
  cardsEl.append(gs);
  $('book').classList.remove('hide');
}
$('bookBtn').addEventListener('click', openBook);
$('book').addEventListener('click', (e) => { if (e.target === $('book') || (e.target as HTMLElement).closest('.x')) $('book').classList.add('hide'); });
let helpStep = 0;
function showHelp() {
  const v = $('helpVid') as HTMLVideoElement;
  v.src = `help/${helpStep + 1}.mp4`;
  void v.play().catch(() => { /* autoplay may need a tap */ });
  $('helpTxt').textContent = (en as Record<string, string>)[`help.step${helpStep + 1}`]!;
  $('hDots').innerHTML = Array.from({ length: 7 }, (_, i) => `<i class="${i === helpStep ? 'on' : ''}"></i>`).join('');
}
$('helpBtn').addEventListener('click', () => { $('helpBtn').classList.remove('pulse'); helpStep = 0; showHelp(); $('help').classList.remove('hide'); });
$('hPrev').addEventListener('click', () => { helpStep = Math.max(0, helpStep - 1); showHelp(); });
$('hNext').addEventListener('click', () => { if (helpStep === 6) $('help').classList.add('hide'); else { helpStep++; showHelp(); } });
$('help').addEventListener('click', (e) => { if (e.target === $('help') || (e.target as HTMLElement).closest('.x')) $('help').classList.add('hide'); });

// ---- recording, saved songs, playback and export ----
const MAX_SONGS = 50;
const loadSongs = (): Song[] => { try { return JSON.parse(localStorage.getItem('hum.songs') ?? '[]') as Song[]; } catch { return []; } };
const saveSongs = (a: Song[]) => { try { localStorage.setItem('hum.songs', JSON.stringify(a)); } catch { /* storage unavailable */ } };
const fmt = (bars: number, bpm: number) => { const s = Math.round(bars * barSec(bpm)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const stageOf = (song: Song) => STAGES.find((x) => x.id === song.stageId)!;

function setRecUi() {
  const b = $('recBtn');
  b.classList.toggle('recording', recording);
  b.setAttribute('aria-label', recording ? 'Stop recording' : 'Record');
  $('recLbl').textContent = recording ? '0:00' : 'Record';
}
function stopRecording() {
  if (!session || !session.recorder) return;
  const song = session.stopRecording({ id: `song_${Date.now()}`, name: autoName(loadSongs().map((x) => x.name)), createdAt: Date.now() });
  recording = false; setRecUi();
  if (!song) return;
  const all = [...loadSongs(), song]; saveSongs(all);
  toast(`${P.sticker(30)}<span>Song saved: ${song.name}</span>`);
  renderSongs();
}
$('recBtn').addEventListener('click', () => {
  if (!session || !ready || playMode) return;
  if (recording) return stopRecording();
  if (loadSongs().length >= MAX_SONGS) { toast('<span>Song list is full (50). Delete one to record again.</span>'); return; }
  session.startRecording(); recording = true; setRecUi();
});
setInterval(() => {
  if (!recording || !session?.recorder) return;
  const bars = Math.max(0, session.lastProvidedBar + 1 - session.recorder.startBar);
  const secs = Math.round(bars * barSec(stage.bpm));
  $('recLbl').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  $('recBtn').classList.toggle('warn', bars >= warnBars(stage.bpm));
  if (bars >= session.recorder.maxBarCount) stopRecording();
}, 250);

function renderSongs() {
  const list = loadSongs();
  const el = $('songList');
  if (!list.length) { el.innerHTML = `<div class="empty">${P.sticker(48)}<p>No songs yet</p><p class="hint">Tap the red record button on the stage, play something, and your song shows up here.</p></div>`; return; }
  el.innerHTML = '';
  [...list].reverse().forEach((song) => {
    const st = stageOf(song);
    const row = document.createElement('div'); row.className = 'srow';
    row.innerHTML = `<span class="wi">${worldIconSvg(st.id, 30)}</span><div class="sinfo"><input class="sname" value="${song.name.replace(/"/g, '&quot;')}" maxlength="24" aria-label="Song name"><small>${fmt(song.bars, st.bpm)} · ${song.bars} bars · ${new Date(song.createdAt).toLocaleDateString()}</small></div>`;
    const btn = (label: string, svgHtml: string, fn: () => void, cls = '') => { const b = document.createElement('button'); b.className = `ic ${cls}`; b.setAttribute('aria-label', label); b.title = label; b.innerHTML = svgHtml; b.addEventListener('click', fn); return b; };
    row.append(
      btn('Play', P.play(24), () => { $('songs').classList.add('hide'); void playSong(song); }),
      btn('Share or save audio', '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 15V4M8 8l4-4 4 4M5 12v8h14v-8"/></svg>', () => void exportWav(song)),
      btn('Delete (tap twice)', '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>', () => {}, 'del'),
    );
    const del = row.querySelector('.del') as HTMLButtonElement;
    let armed = false;
    del.addEventListener('click', () => { if (!armed) { armed = true; del.classList.add('armed'); setTimeout(() => { armed = false; del.classList.remove('armed'); }, 2500); return; } saveSongs(loadSongs().filter((x) => x.id !== song.id)); renderSongs(); });
    (row.querySelector('.sname') as HTMLInputElement).addEventListener('change', (e) => { const name = (e.target as HTMLInputElement).value.trim().slice(0, 24) || song.name; saveSongs(loadSongs().map((x) => (x.id === song.id ? { ...x, name } : x))); });
    el.append(row);
  });
}
$('songsBtn').addEventListener('click', () => { renderSongs(); $('songs').classList.remove('hide'); });
$('songs').addEventListener('click', (e) => { if (e.target === $('songs') || (e.target as HTMLElement).closest('.x')) $('songs').classList.add('hide'); });

async function playSong(song: Song) {
  const st = stageOf(song);
  ready = false;
  engine.stop();
  stageIdx = STAGES.indexOf(st); stage = st;
  document.querySelectorAll('#worlds button').forEach((b, k) => b.classList.toggle('on', k === stageIdx));
  placedAnim.clear(); drags = []; returning = []; celebration = null; popup = null; recording = false; setRecUi();
  await engine.init();
  await Promise.all([engine.loadStage(st), loadAtlas(st.id)]);
  const fake = { state: stateAtBar(song, 0), recorder: null, countIn: false, lastProvidedBar: 0, goals: { progress: () => [] }, discoveredInStage: 0, dispatch() {}, replayCombo() {}, startRecording() {}, setEvents() {} } as unknown as Session;
  session = fake;
  playMode = { song };
  $('playbar').classList.remove('hide');
  const provider = songProvider(st, song);
  const seen = new Set<string>();
  engine.start(st.bpm, (bar) => {
    const state = stateAtBar(song, bar);
    const now = performance.now();
    placedAnim.clear();
    state.spots.forEach((id) => { if (id && !seen.has(id)) { placedAnim.set(id, { since: now, from: { x: layout.slotPos[st.creatures.findIndex((c) => c.id === id)]!.x, y: layout.slotPos[0]!.y } }); } });
    seen.clear(); state.spots.forEach((id) => { if (id) seen.add(id); });
    fake.state = state;
    const cid = comboStartsAt(song, bar);
    if (cid) { const combo = st.combos.find((c) => c.id === cid)!; celebration = { comboId: cid, creatureIds: [...combo.creatureIds], startBeat: bar * 4 }; }
    else if (celebration && bar * 4 - celebration.startBeat >= 32) celebration = null;
    if (bar > song.bars) setTimeout(stopPlayback, 0);
    return provider(bar);
  });
}
function stopPlayback() {
  if (!playMode) return;
  playMode = null; $('playbar').classList.add('hide');
  void openStage(stageIdx);
}
$('stopPlay').addEventListener('click', stopPlayback);

async function exportWav(song: Song) {
  const st = stageOf(song);
  toast('<span>Preparing audio…</span>');
  try {
    await engine.init();
    const files = [...st.creatures.map((c) => c.loopFile), ...st.combos.map((c) => c.bonusLoopFile)];
    const bank = await engine.decodeBank(files, samplesPerBar(st.bpm) * st.loopBars);
    const { samples } = renderSong(st, song, bank);
    const blob = new Blob([encodeWav(samples, 48000) as BlobPart], { type: 'audio/wav' });
    const file = new File([blob], `Hummlings - ${song.name}.wav`, { type: 'audio/wav' });
    const nav = navigator as Navigator & { canShare?: (d: object) => boolean; share?: (d: object) => Promise<void> };
    if (nav.canShare?.({ files: [file] })) { await nav.share!({ files: [file], title: song.name }); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.append(a); a.click(); a.remove();
    toast('<span>Audio file created. If nothing downloaded, your browser blocks it here; the app shares it.</span>');
  } catch { toast('<span>Could not prepare the audio file.</span>'); }
}
renderSongs();

// ---- undo for Clear and Surprise (7 seconds) ----
let undoState: StageState | null = null;
let undoTimer: ReturnType<typeof setTimeout> | undefined;
function rememberForUndo() {
  if (!session || !session.state.spots.some(Boolean)) return;
  undoState = session.state;
  $('undo').classList.remove('hide');
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => $('undo').classList.add('hide'), 7000);
}
$('undo').addEventListener('click', () => {
  const b = undoState;
  if (!session || !b) return;
  const s = session;
  s.state.spots.forEach((id) => { if (id) s.dispatch({ kind: 'remove', creatureId: id }); });
  b.spots.forEach((id, spot) => {
    if (!id) return;
    placedAnim.set(id, { since: performance.now(), from: layout.spots[spot]! });
    s.dispatch({ kind: 'drop', creatureId: id, spot });
    const v = b.volume[id];
    if (v !== undefined) s.dispatch({ kind: 'volume', creatureId: id, value: v });
    if (b.muted[id]) s.dispatch({ kind: 'mute', creatureId: id });
  });
  $('undo').classList.add('hide');
});
