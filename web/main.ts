// Playable web demo of Hummlings (Canvas 2D + Web Audio) using the real core logic and the real loops.
import { beatBounce, blinkOpen, breath, hop, onsetPulse } from '../src/core/anim';
import { GestureTracker, type GestureEvent, type World } from '../src/core/gestures';
import { computeLayout, popupRects, type Layout } from '../src/core/layout';
import { Session } from '../src/core/session';
import { TUNING } from '../src/core/tuning';
import { LAYER_COLORS, type Creature, type Layer, type Stage } from '../src/core/types';
import { validateStage } from '../src/core/schema';
import pond from '../content/stages/1-pond.json';
import fair from '../content/stages/2-fair.json';
import clouds from '../content/stages/3-clouds.json';
import neon from '../content/stages/4-neon.json';
import frost from '../content/stages/5-frost.json';
import { WebEngine } from './engine';
import { bootSkia, type Skia2 } from './skiaBoot';
import { StageView } from './stageView';
import { audibleIds, swapSpot } from '../src/core/stageState';
import { drawComboCard } from '../src/ui/draw/comboCard';
import type { SceneInput } from '../src/ui/draw/scene';
import type { TapEffect } from '../src/ui/draw/scenery';
import { initHome } from './home';
import { isRtl, resolveLang, setLang, t as tr } from '../src/i18n';
import { LESSON_FINISH_MS, LESSON_LAYERS, LESSON_LEVELS, LESSON_SCROLL_WAIT_MS, QUIET_BELOW, level2Cue, level2Step, level3Cue, level3Step, levelBand, lessonCue, lessonLit, lessonPickable, lessonScrollTarget, lessonStep, lessonSteps, lessonTotalCoins, levelKey, nextLevel, type LessonFx, type LessonLevel, type LessonView } from '../src/core/lesson';
import type { CoachCue } from '../src/core/coach';
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
let view: StageView | null = null;
let skiaBook: Skia2 | null = null;
const dprNow = () => Math.min(2, window.devicePixelRatio || 1);
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
let lastBeat = 0;
const taps: TapEffect[] = [];
const addTap = (x: number, y: number, kind: TapEffect['kind'], t: number, color?: string) => { while (taps.length && t - taps[0]!.t0 > 1400) taps.shift(); taps.push({ x, y, t0: t, kind, color }); };
let rewardP: { progress: number } | null = null;
let popup: { spot: number; creatureId: string } | null = null;
let trayOpen = true;
let trayK = 1; // 1 = shown, 0 = tucked away (animated)
let playMode: { song: Song } | null = null;
let recording = false;
let ready = false;
let hint = true;
// Opening the page with #reset starts the game from the very beginning (the lesson, found combos, stickers, songs and coins are forgotten).
function resetIfAsked(): boolean {
  if (location.hash !== '#reset') return false;
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('hum.')) localStorage.removeItem(k); } catch { /* storage unavailable */ }
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  return true;
}
resetIfAsked();
addEventListener('hashchange', () => { if (resetIfAsked()) location.reload(); }); // the page was already open: forget everything, then start over
const store = { get: (k: string): string[] => { try { return JSON.parse(localStorage.getItem(k) ?? '[]') as string[]; } catch { return []; } }, set: (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } } };
const found = new Set<string>(store.get('hum.combos'));
const stickers = new Set<string>(store.get('hum.goals'));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// The levels of the first world (src/core/lesson.ts), the same rules as the app.
const lessonsDone = new Set<string>(store.get('hum.lessons'));
let coins = (() => { try { return Math.max(0, Number(localStorage.getItem('hum.coins') ?? 0) || 0); } catch { return 0; } })();
let lessonMode: 'play' | 'done' | null = null;
let lessonLevel: LessonLevel = 1; // 1: four groups lit one at a time, 2: my band (silence, wake, choose), 3: volume (lower, raise, star)
let silenced = false; // level 2: a singer was silenced at least once
let quiet = false; // level 3: a singer's volume went under the quiet line at least once
const lessonStepNow = (): number => {
  const st = session?.state;
  if (!st) return 0;
  return lessonLevel === 1 ? lessonStep(stage, st.spots) : lessonLevel === 2 ? level2Step(st.spots, st.muted, silenced) : level3Step(st.spots, st.volume, st.solo, quiet);
};
const lessonMeta = { step: -1, prev: null as Layer | null, since: 0, sinceMs: 0, fx: [] as LessonFx[] };
let lessonDir: -1 | 0 | 1 = 0;
let lessonTouchAt = 0, lessonScrollAt = 0;
let lessonTimer: ReturnType<typeof setTimeout> | undefined;

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = r.width; H = r.height;
  layout = computeLayout(W, H, undefined, 12, $('bar').offsetHeight + 4);
  view?.resize(W, H, dpr);
}
addEventListener('resize', () => { resize(); $('rotate').classList.toggle('hide', innerWidth >= innerHeight); });

const rnd = (i: number) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0; return h; };
const burst = (x: number, y: number, _c: string[], _n: number, kind: 'star' | 'spark', t: number, _speed?: number) => addTap(x, y, kind === 'star' ? 'star' : 'spark', t);
let scrollAnim = 0;
function scrollTrayTo(target: number, ms = 380) {
  const from = scrollX, to = Math.max(0, Math.min(layout.scrollMax, target)), t0 = performance.now();
  const id = ++scrollAnim;
  const step = (now: number) => { if (id !== scrollAnim) return; const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3; scrollX = from + (to - from) * e; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function syncArrows() {
  const show = trayOpen && trayK > 0.9 && layout.scrollMax > 0;
  const y = layout.tray.y + layout.tray.h / 2 - 22;
  const l = $('tl'), r = $('tr');
  if (lessonMode === 'play') { l.classList.toggle('hide', lessonDir !== -1); r.classList.toggle('hide', lessonDir !== 1); }
  else { l.classList.toggle('hide', !(show && scrollX > 8)); r.classList.toggle('hide', !(show && scrollX < layout.scrollMax - 8)); }
  l.style.left = '10px'; r.style.right = '10px'; l.style.top = r.style.top = `${y}px`;
}
const scrollToLit = () => {
  if (lessonLevel === 2) { scrollTrayTo(scrollX + (lessonDir || 1) * layout.W * 0.6, 600); return; }
  const lit = lessonLit(lessonStep(stage, session?.state.spots ?? []));
  const target = lit ? lessonScrollTarget(stage, layout, scrollX, lit) : null;
  if (target !== null) scrollTrayTo(target, 700);
};
$('tl').addEventListener('click', () => (lessonMode === 'play' ? scrollToLit() : scrollTrayTo(scrollX - layout.W * 0.6)));
$('tr').addEventListener('click', () => (lessonMode === 'play' ? scrollToLit() : scrollTrayTo(scrollX + layout.W * 0.6)));
const LAYER_OF = (id: string) => stage.creatures.find((c) => c.id === id)?.layer;
function frame(t: number) {
  requestAnimationFrame(frame);
  if (!session || !view) return;
  const st = session.state;
  const beat = engine.state === 'running' ? engine.positionBeats() : -1;
  // the singer menu slides away and back
  trayK += ((trayOpen ? 1 : 0) - trayK) * 0.22;
  if (Math.abs((trayOpen ? 1 : 0) - trayK) < 0.002) trayK = trayOpen ? 1 : 0;
  returning = returning.filter((r) => t - r.since < TUNING.hopMs + 40);
  const rw = session.reward;
  if (rw && !session.celebrating) {
    const total = Math.max(1, rw.startBeat - rw.fromBeat), left = Math.max(0, rw.startBeat - beat);
    rewardP = { progress: Math.min(1, Math.max(0, 1 - left / total)) };
  } else rewardP = null;
  const celeb = celebration ? { celebrationId: stage.combos.find((c) => c.id === celebration!.comboId)!.celebrationId, creatureIds: celebration.creatureIds, startBeat: celebration.startBeat } : null;
  const muted: Record<string, true> = {};
  for (const id of Object.keys(st.muted)) if (st.muted[id]) muted[id] = true;
  const pu = popup ? { spot: popup.spot, creatureId: popup.creatureId, volume: st.volume[popup.creatureId] ?? 1, solo: st.solo === popup.creatureId } : null;
  let coach: CoachCue | null = null, lessonView: LessonView | null = null;
  if (lessonMode === 'play' && !playMode) {
    const step = lessonStepNow(), m = lessonMeta;
    if (step !== m.step) { m.prev = lessonLevel === 1 && m.step >= 0 ? lessonLit(m.step) : null; m.step = step; m.since = t; m.sinceMs = t; }
    m.fx = m.fx.filter((f) => t - f.t0 < 1300);
    coach = lessonLevel === 1 ? lessonCue(stage, layout, scrollX, st.spots, step) : lessonLevel === 2 ? level2Cue(stage, layout, scrollX, st.spots, st.muted, step) : level3Cue(stage, st.spots, st.volume, popup ? { spot: popup.spot } : null, step);
    lessonView = lessonLevel === 1
      ? { slots: LESSON_LAYERS.map((l) => LAYER_COLORS[l]), dim: false, lit: lessonLit(step), prev: m.prev, since: m.since, done: step, topY: 34, fx: m.fx }
      : { slots: ['#FFE066', '#FFE066', '#FFE066'], dim: lessonLevel === 3 || step < 2, lit: null, prev: null, since: m.since, done: step, topY: 34, fx: m.fx };
    lessonDir = coach?.kind === 'swipe' ? (coach.dir ?? 1) : 0;
    const lit = lessonLevel === 1 ? lessonLit(step) : null;
    // the menu slides to the lit group by itself when nobody does
    if (lit && lessonDir !== 0 && tracker.activeCount === 0 && t - lessonTouchAt > LESSON_SCROLL_WAIT_MS && t - m.sinceMs > LESSON_SCROLL_WAIT_MS && t - lessonScrollAt > 2000) {
      const target = lessonScrollTarget(stage, layout, scrollX, lit);
      if (target !== null) { lessonScrollAt = t; scrollTrayTo(target, 900); }
    }
  } else lessonDir = 0;
  const input: SceneInput = {
    layout, stage,
    placed: st.spots.flatMap((id, spot) => { if (!id) return []; const a = placedAnim.get(id); return [{ id, spot, since: a?.since ?? -1e6, from: a?.from ?? layout.spots[spot]! }]; }),
    muted, solo: st.solo, drags, returning, scrollX, beat, timeMs: t, reduceMotion, celebration: celeb,
    hint: hint && ready && drags.length === 0 && st.spots.every((x) => !x), hintSlot: 0, recordingBeat: null,
    popup: pu, trayK, reward: rewardP, taps, volumes: st.volume, coach, lesson: lessonView,
  };
  view.draw(input, W, H);
  syncArrows();
  lastBeat = beat;
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

function world(): World {
  const on = lessonMode === 'play', step = on ? lessonStepNow() : 99, lvl = lessonLevel;
  return { layout, scrollX, trayIds: stage.creatures.map((c) => c.id), onStage: session!.state.spots, popup, volumeOf: (id) => session!.state.volume[id] ?? 1, trayHidden: !trayOpen, canPick: on ? (id) => lessonPickable(lvl, stage, step, id) : undefined, locked: on && lvl === 1, tapOnly: on && lvl === 2, holdOnly: on && lvl === 3, noHide: on };
}

function syncLessonUi() {
  document.body.classList.toggle('lesson', lessonMode === 'play');
  $('lessonSkip').classList.toggle('hide', lessonMode !== 'play');
  $('lessonSkip').setAttribute('aria-label', tr('a11y.lessonSkip'));
  $('lessonSkip').setAttribute('title', tr('a11y.lessonSkip'));
}
function endLesson() { // leaves the levels for free play (the skip button marks this world's levels as done)
  clearTimeout(lessonTimer);
  if (lessonMode === 'play') { for (const l of LESSON_LEVELS) lessonsDone.add(levelKey(stage.id, l)); store.set('hum.lessons', [...lessonsDone]); }
  lessonMode = null;
  $('lessonDone').classList.add('hide');
  syncLessonUi();
}
/** Levels 2 and 3 start with a ready-made band that hops on, already playing. */
function placeBand(t: number) {
  const s = session!, band = levelBand(lessonLevel, stage);
  if (!band) return;
  band.ids.forEach((id, k) => {
    const i = stage.creatures.findIndex((c) => c.id === id);
    placedAnim.set(id, { since: t + k * 140, from: { x: layout.slotPos[i]!.x - scrollX, y: layout.slotPos[i]!.y } });
    s.dispatch({ kind: 'drop', creatureId: id, spot: band.spots[k]! });
  });
  s.countIn = false; hint = false; silenced = false; quiet = false;
}
function afterLessonDone() {
  const nx = nextLevel(stage.id, [...lessonsDone]);
  if (nx !== null && nx > lessonLevel && session) {
    const t = performance.now();
    popup = null;
    session.state.spots.forEach((id, sp) => { if (id) returning.push({ id, since: t, from: layout.spots[sp]! }); });
    session.dispatch({ kind: 'clear' });
    taps.length = 0; lessonMeta.step = -1; lessonMeta.prev = null; lessonMeta.fx = []; lessonDir = 0; lessonTouchAt = t;
    lessonLevel = nx; lessonMode = 'play';
    $('lessonDone').classList.add('hide');
    scrollTrayTo(0, 300);
    placeBand(t);
    syncLessonUi();
  } else { clearTimeout(lessonTimer); lessonMode = null; $('lessonDone').classList.add('hide'); syncLessonUi(); }
}
function showLessonDone() {
  lessonMode = 'done';
  syncLessonUi();
  const total = lessonTotalCoins(lessonLevel);
  const coin = (px: number) => `<span class="coin" style="width:${px}px;height:${px}px">${P.star(px * 0.6, '#FFF3C4')}</span>`;
  const el = $('lessonDone');
  el.setAttribute('aria-label', tr('lesson.done'));
  el.innerHTML = `<div class="lcard"><h2>${tr('lesson.done')}</h2>` +
    `<div class="lstars">${[0, 1, 2].map((i) => `<span style="animation-delay:${0.35 + i * 0.26}s">${P.star(i === 1 ? 74 : 58, '#FFC857')}</span>`).join('')}</div>` +
    `<div class="lcoins" aria-label="${total}">${Array.from({ length: lessonSteps(lessonLevel) }, () => coin(30)).join('')}<b id="lcount">+0</b></div>` +
    `<button id="lessonNext" aria-label="${tr('a11y.lessonNext')}"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>`;
  el.classList.remove('hide');
  $('lessonNext').addEventListener('click', afterLessonDone);
  const t0 = performance.now() + 900;
  const id = setInterval(() => {
    const k = Math.min(1, Math.max(0, (performance.now() - t0) / 1200));
    const c = document.getElementById('lcount');
    if (c) c.textContent = `+${Math.round(total * k)}`;
    if (k >= 1 || !c) clearInterval(id);
  }, 40);
}
$('lessonSkip').addEventListener('click', endLesson);
/** A singer of the lit group landed: a coin flies to the counter, stars burst, and with the fourth the whole song plays and the success card follows. */
function lessonLanded(stepBefore: number, spot: number, t: number) {
  const step = lessonStepNow();
  if (step <= stepBefore) return;
  const sp = layout.spots[spot]!;
  for (let k = 0; k < step - stepBefore; k++) lessonMeta.fx.push({ x: sp.x, y: sp.y - layout.size * 0.6, t0: t + k * 200, slot: stepBefore + k });
  if (!reduceMotion) addTap(sp.x, sp.y - layout.size * 0.5, 'star', t);
  if (step >= lessonSteps(lessonLevel)) {
    engine.playSfx('combo');
    [0.18, 0.38, 0.62, 0.82].forEach((f, i) => addTap(W * f, layout.stageH * (0.28 + 0.1 * (i % 2)), 'spark', t));
    const key = levelKey(stage.id, lessonLevel);
    if (!lessonsDone.has(key)) { coins += lessonTotalCoins(lessonLevel); try { localStorage.setItem('hum.coins', String(coins)); } catch { /* storage unavailable */ } }
    lessonsDone.add(key); store.set('hum.lessons', [...lessonsDone]);
    lessonTimer = setTimeout(() => { engine.playSfx('goal'); session?.dispatch({ kind: 'endSolo' }); popup = null; if (lessonMode === 'play') showLessonDone(); }, LESSON_FINISH_MS);
  }
}
function apply(ev: GestureEvent, t: number) {
  const s = session!;
  const lessonOn = lessonMode === 'play';
  if (lessonOn && ev.type === 'trayTap' && !lessonPickable(lessonLevel, stage, lessonStepNow(), ev.creatureId)) return;
  if (lessonOn && ev.type === 'drop' && s.state.spots[ev.spot]) { apply({ type: 'returnToTray', touch: ev.touch, creatureId: ev.creatureId, p: ev.p }, t); return; } // never take another singer's place
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
      const stepBefore = lessonOn ? lessonStepNow() : 0;
      engine.playSfx('pop', lessonOn ? popRate(stage.key, Math.min(5, stepBefore + 1)) : popRate(stage.key, ev.spot)); // in the lesson every singer sings a higher note than the last
      addTap(layout.spots[ev.spot]!.x, layout.spots[ev.spot]!.y - layout.size * 0.3, 'drop', t, lessonOn && lessonLevel === 1 ? LAYER_COLORS[LESSON_LAYERS[stepBefore] ?? 'voice'] : stage.palette.glow);
      s.dispatch({ kind: 'drop', creatureId: ev.creatureId, spot: ev.spot });
      if (hint || lessonOn) { hint = false; s.countIn = false; }
      if (lessonOn) lessonLanded(stepBefore, ev.spot, t);
      break;
    }
    case 'returnToTray': drop(ev.creatureId); back(ev.creatureId, { x: ev.p.x, y: ev.p.y + layout.size * 0.6 }); break;
    case 'remove': engine.playSfx('remove'); drop(ev.creatureId); back(ev.creatureId, { x: ev.p.x, y: ev.p.y + layout.size * 0.6 }); s.dispatch({ kind: 'remove', creatureId: ev.creatureId }); break;
    case 'tap': {
      const stepBefore = lessonOn ? lessonStepNow() : 0;
      engine.playSfx(s.state.muted[ev.creatureId] ? 'unmute' : 'mute'); s.dispatch({ kind: 'mute', creatureId: ev.creatureId });
      if (lessonOn && s.state.muted[ev.creatureId]) silenced = true;
      if (lessonOn) lessonLanded(stepBefore, s.state.spots.indexOf(ev.creatureId), t);
      break;
    }
    case 'longPress': { const spot = s.state.spots.indexOf(ev.creatureId); if (spot >= 0) popup = { spot, creatureId: ev.creatureId }; engine.playSfx('pickup'); break; }
    case 'volumeSet': {
      const stepBefore = lessonOn ? lessonStepNow() : 0;
      s.dispatch({ kind: 'volume', creatureId: ev.creatureId, value: ev.value });
      if (lessonOn && ev.value < QUIET_BELOW) quiet = true;
      if (lessonOn) lessonLanded(stepBefore, s.state.spots.indexOf(ev.creatureId), t);
      break;
    }
    case 'popupSolo': {
      const stepBefore = lessonOn ? lessonStepNow() : 0;
      s.dispatch({ kind: 'solo', creatureId: ev.creatureId }); engine.playSfx('pop', 1.5);
      if (lessonOn) lessonLanded(stepBefore, s.state.spots.indexOf(ev.creatureId), t);
      break;
    }
    case 'trayTap': {
      const i = stage.creatures.findIndex((c) => c.id === ev.creatureId);
      // a full stage: the new singer takes the place of one of the same kind (else a muted one, else the first), which hops back to the menu
      const spot = nextFreeSpot(s.state) >= 0 ? nextFreeSpot(s.state) : swapSpot(s.state, LAYER_OF, ev.creatureId);
      if (i < 0) break;
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
        addTap(ev.p.x, ev.p.y, stage.id === 'pond' || stage.id === 'neon' ? 'ripple' : stage.id === 'fair' ? 'spark' : 'star', t);
      }
      break;
    }
    case 'scroll': scrollX = ev.scrollX; break;
  }
}
function pt(e: PointerEvent) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
canvas.addEventListener('pointerdown', (e) => {
  if (!ready || !session || playMode || lessonMode === 'done') return;
  lessonTouchAt = performance.now();
  canvas.setPointerCapture(e.pointerId);
  const t = performance.now();
  if (!reduceMotion) addTap(pt(e).x, pt(e).y, 'press', t);
  tracker.start(e.pointerId, pt(e), Date.now(), world()).forEach((ev) => apply(ev, t));
  if (tracker.hasPendingLongPress) setTimeout(() => tracker.tick(Date.now(), world()).forEach((ev) => apply(ev, performance.now())), TUNING.longPressMs + 10);
});
canvas.addEventListener('pointermove', (e) => { if (ready && session && !playMode && lessonMode !== 'done') { lessonTouchAt = performance.now(); } if (ready && session && !playMode && lessonMode !== 'done') tracker.move(e.pointerId, pt(e), Date.now(), world()).forEach((ev) => apply(ev, performance.now())); });
const up = (e: PointerEvent) => { if (ready && session && !playMode) tracker.end(e.pointerId, pt(e), Date.now(), world()).forEach((ev) => apply(ev, performance.now())); };
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', (e) => { if (session) tracker.cancel(e.pointerId, world()).forEach((ev) => apply(ev, performance.now())); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

async function loadAtlas(id: string) {
  const img = new Image();
  img.src = `sprites/${id}.png`;
  try { await img.decode(); atlas = img; } catch { atlas = null; }
}

async function openStage(i: number) {
  ready = false;
  session = null; // the frame loop pauses until the new world is ready
  $('loading').innerHTML = `${worldIconSvg(STAGES[i]!.id, 84)}<span class="spin"></span>`;
  $('loading').classList.remove('hide');
  engine.stop();
  stageIdx = i; stage = STAGES[i]!;
  placedAnim.clear(); drags = []; returning = []; celebration = null; scrollX = 0; hint = true;
  clearTimeout(lessonTimer);
  const lv = nextLevel(stage.id, [...lessonsDone]);
  lessonMode = lv ? 'play' : null; lessonLevel = lv ?? 1; silenced = false; quiet = false;
  lessonMeta.step = -1; lessonMeta.prev = null; lessonMeta.fx = []; lessonDir = 0; lessonTouchAt = performance.now(); $('lessonDone').classList.add('hide');
  if (lessonMode === 'play') hint = false; // the lesson has its own hand
  syncLessonUi();
  document.querySelectorAll('#worlds button').forEach((b, k) => b.classList.toggle('on', k === i));
  await engine.init();
  await Promise.all([engine.loadStage(stage), loadAtlas(stage.id)]);
  session = new Session(stage, engine, {
    onCelebration: (id, bar) => { const c = stage.combos.find((q) => q.id === id)!; celebration = { comboId: id, creatureIds: [...c.creatureIds], startBeat: bar * 4 }; found.add(id); store.set('hum.combos', [...found]); engine.playSfx('combo'); toast(`${P.star(30)}${P.book(30)}<span>${en['combo.found']}</span>`); },
    onCelebrationEnd: () => { celebration = null; },
    onGoal: (key) => { stickers.add(key); store.set('hum.goals', [...stickers]); engine.playSfx('goal'); toast(`${P.sticker(30)}${GOAL_PICTO[key.split(':')[1]!]?.(24) ?? ''}<span>${(en as Record<string, string>)['goal.' + key.split(':')[1]]}</span>`); burst(W / 2, H * 0.3, ['#FFC857', '#FFFFFF', '#5FE3C0'], 16, 'star', performance.now(), 220); },
  }, [...found], [...stickers]);
  session.countIn = true;
  session.start();
  if (lessonMode === 'play' && lessonLevel >= 2) placeBand(performance.now());
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
setLang(resolveLang('system', navigator.language));
document.documentElement.lang = navigator.language;
$('splash').dir = isRtl() ? 'rtl' : 'ltr'; // only the home screen is translated (the rest of the demo is in English)
const skiaP = bootSkia('canvaskit.wasm');
void skiaP.then((sk2: Skia2) => { skiaBook = sk2; view = new StageView(sk2, canvas); view.resize(W, H, dprNow()); }).catch((e) => console.error('skia', e));
initHome({
  splash: $('splash'), canvas: $<HTMLCanvasElement>('homeCv'), engine, stages: STAGES, creatures: STAGES[0]!.creatures, skia: skiaP,
  foundOf: (i) => STAGES[i]!.combos.filter((c) => found.has(c.id)).length,
  onPick: (i) => { $('splash').classList.add('hide'); void openStage(i); },
  onHelp: () => $('helpBtn').click(), onSongs: () => $('songsBtn').click(),
});
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
    // the card is drawn by the app's own drawing code
    const cw = 200, ch = 120, dpr = Math.min(2, devicePixelRatio || 1);
    const cv = document.createElement('canvas'); cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); cv.style.width = `${cw}px`; cv.style.height = `${ch}px`; cv.style.borderRadius = '12px';
    if (skiaBook) {
      const { sk, ck } = skiaBook, surf = ck.MakeSWCanvasSurface(cv);
      if (surf) {
        const rec = sk.PictureRecorder();
        drawComboCard(sk, rec.beginRecording({ x: 0, y: 0, width: cw, height: ch }), stage, c, cw, ch, f, audibleIds(s.state));
        const pic = rec.finishRecordingAsPicture();
        const rc = surf.getCanvas(); rc.scale(dpr, dpr); rc.drawPicture((pic as any).ref ?? pic); surf.flush();
      }
    }
    const n = s.state.solo ? 0 : c.creatureIds.filter((id) => on.has(id)).length;
    const dots = document.createElement('div'); dots.className = 'combo' + (f ? ' found' : ''); dots.style.display = 'flex'; dots.style.gap = '6px';
    dots.innerHTML = [0, 1, 2, 3].map((i) => `<i class="${f || i < n ? 'lit' : ''}"></i>`).join('');
    card.append(cv, dots);
    if (f) { const b = document.createElement('button'); b.textContent = 'Replay the show'; b.addEventListener('click', () => { $('book').classList.add('hide'); s.replayCombo(c.id); }); card.append(b); }
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
  toast(`${P.sticker(30)}<span>${en['rec.saved']}</span>`);
  renderSongs();
}
$('recBtn').addEventListener('click', () => {
  if (!session || !ready || playMode) return;
  if (recording) return stopRecording();
  if (loadSongs().length >= MAX_SONGS) { toast(`<span>${en['songs.limit']}</span>`); return; }
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
      btn('Download song', '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 15V4M8 8l4-4 4 4M5 12v8h14v-8"/></svg>', () => void exportWav(song)),
      btn('Delete. Tap again to confirm.', '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>', () => {}, 'del'),
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
  clearTimeout(lessonTimer); lessonMode = null; lessonMeta.fx = []; syncLessonUi();
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
  toast('<span>Preparing your song…</span>');
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
    toast('<span>Your audio file is ready. If nothing downloaded, your browser may have blocked it. The app can share songs directly.</span>');
  } catch { toast('<span>Could not make the audio file. Please try again.</span>'); }
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
