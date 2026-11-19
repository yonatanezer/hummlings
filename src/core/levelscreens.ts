import type { LevelState } from './lesson';

/**
 * The three full-screen moments of the levels, drawn by the scene (src/ui/draw/levelart.ts) so that the app and the web demo look the same:
 * 'map' = the level map of a world, 'done' = the success card, 'intro' = the banner that names a level for a moment when it starts.
 * Text and touch targets are the screens' own (React Native / DOM) and sit on the rectangles computed here.
 */
export interface ScreenView {
  kind: 'map' | 'done' | 'intro';
  since: number; // scene time at which it appeared
  level: number; // map: the level that waits (0: none, all done); done / intro: the level
  hopFrom: number; // map: the level the mascot walks from (0: none, it just stands)
  states: LevelState[]; // map: one per level
  rtl: boolean;
  steps: number; // done: coins earned one by one (one icon each)
  last: boolean; // done: the last level of the world (the button leads to free play)
}

export interface Disc { x: number; y: number; r: number }
export interface Box { x: number; y: number; w: number; h: number }

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The circles of the map along a gentle wave, the free-play circle last. Mirrored for right-to-left languages (level 1 starts on the right). */
export function mapLayout(W: number, H: number, n: number, rtl: boolean): { nodes: Disc[]; free: Disc; back: Disc; coins: Box } {
  const r = clamp(H * 0.115, 26, 50);
  const padX = Math.max(r * 1.8, W * 0.115);
  const cy = H * 0.56, amp = H * 0.085;
  const pts: Disc[] = Array.from({ length: n + 1 }, (_, i) => {
    const t = n === 0 ? 0.5 : i / n;
    const x = padX + (W - 2 * padX) * (rtl ? 1 - t : t);
    const y = cy + amp * Math.sin(i * 1.7 + 0.35) * (i % 2 === 0 ? 1 : -1) * 0.9;
    return { x, y, r: i === n ? r * 1.18 : r };
  });
  const free = pts[n]!;
  const bx = rtl ? W - 36 : 36;
  return { nodes: pts.slice(0, n), free, back: { x: bx, y: 36, r: 24 }, coins: { x: W / 2 - 62, y: 14, w: 124, h: 44 } };
}

/** The success card: a card with a ribbon on top, three stars, the coins, and the continue button. */
export function doneLayout(W: number, H: number): { card: Box; ribbon: Box; stars: Disc[]; coinsY: number; countX: number; button: Disc; u: number } {
  const u = clamp(Math.min(W / 844, H / 390), 0.7, 2);
  const w = Math.min(W - 24, 430 * u), h = Math.min(H - 20, 322 * u);
  const card: Box = { x: (W - w) / 2, y: (H - h) / 2 + 6, w, h };
  const ribbon: Box = { x: card.x + w * 0.12, y: card.y - 20 * u, w: w * 0.76, h: 46 * u };
  const sr = 31 * u;
  const stars: Disc[] = [-1, 0, 1].map((k) => ({ x: card.x + w / 2 + k * sr * 2.35, y: card.y + h * 0.33 + (k === 0 ? -8 * u : 4 * u), r: k === 0 ? sr * 1.3 : sr }));
  return { card, ribbon, stars, coinsY: card.y + h * 0.6, countX: card.x + w / 2, button: { x: card.x + w / 2, y: card.y + h * 0.84, r: 35 * u }, u };
}

/** The banner that names a level when it starts: a ribbon just under the counter. */
export function introLayout(W: number, stageH: number): Box {
  const u = clamp(Math.min(W / 844, stageH / 280), 0.7, 2);
  const w = 200 * u, h = 58 * u;
  return { x: (W - w) / 2, y: 70 * u, w, h };
}

/** The row of coins on the success card: the first coin's centre, the distance between coins, their radius, and where the "+N" starts. */
export function doneCoinRow(card: Box, countX: number, u: number, n: number): { x0: number; gap: number; r: number; endX: number } {
  const r = 15 * u, gap = r * 2.45, w = n * gap;
  const left = countX - 34 * u - w / 2;
  return { x0: left + gap / 2, gap, r, endX: left + w + 8 * u };
}
