import { TUNING } from './tuning';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

export interface Layout {
  W: number;
  H: number;
  u: number; // scale unit
  stageH: number; // height of the stage area
  size: number; // creature body box
  spots: Pt[]; // feet position of each of the 6 spots
  tray: Rect;
  slot: number; // tray slot size
  slotPos: Pt[]; // centre of each tray slot, before scrolling
  trayContentW: number;
  scrollMax: number;
  topBar: number;
}

const clamp = (v: number, lo: number, hi: number): number => {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
};

/** Geometry of the stage screen (see LAYOUT.md). W x H = safe-area-reduced window in points. */
export function computeLayout(W: number, H: number, creatureCountArg?: number, padX = 0, topInset = 0): Layout {
  'worklet'; // also called from the help screen's drawing worklet
  // Default resolved in the body: a default-param expression is not captured into the worklet closure.
  const creatureCount = creatureCountArg ?? TUNING.creaturesPerStage;
  const u = clamp(Math.min(W / 844, H / 390), 0.8, 2.2);
  const stageH = 0.65 * H;
  // The tallest singer (tall body + ears, about 1.5 x size) must fit between the top overlay and the back row of spots.
  const sizeByTop = (0.48 * H - topInset) / 1.5;
  const size = clamp(Math.min(0.32 * H, (0.76 * W) / TUNING.maxSpots, sizeByTop), TUNING.minTouchPt, 200);
  const spots: Pt[] = Array.from({ length: TUNING.maxSpots }, (_, i) => {
    const t = (i + 0.5) / TUNING.maxSpots;
    return { x: W * (0.12 + 0.76 * t), y: 0.6 * H - 0.12 * H * 4 * t * (1 - t) };
  });
  const tray: Rect = { x: 0, y: stageH, w: W, h: H - stageH };
  const groupGap = 16 * u;
  const per = Math.max(1, Math.round(creatureCount / 4)); // one colour-coded group per layer
  const groups = Math.ceil(creatureCount / per);
  const pad = Math.max(12 * u, padX);
  const ideal = clamp(0.56 * tray.h, TUNING.minTouchPt, 84);
  const fit = (W - pad * 2 - (groups - 1) * groupGap) / creatureCount; // slot size at which all creatures fit without scrolling
  const slot = fit >= TUNING.minTouchPt ? Math.min(ideal, fit) : ideal; // phones: keep it big and scroll
  const trayContentW = pad * 2 + creatureCount * slot + (groups - 1) * groupGap;
  const slotPos: Pt[] = Array.from({ length: creatureCount }, (_, i) => ({
    x: pad + slot / 2 + i * slot + Math.floor(i / per) * groupGap,
    y: tray.y + tray.h / 2,
  }));
  // When everything fits, centre the row.
  const offset = trayContentW < W ? (W - trayContentW) / 2 : 0;
  for (const p of slotPos) p.x += offset;
  return { W, H, u, stageH, size, spots, tray, slot, slotPos, trayContentW, scrollMax: Math.max(0, trayContentW - W), topBar: 56 };
}

/** Nearest free-or-occupied spot within reach of a drop point, or -1 (drop outside any spot returns to the tray). */
export function spotAt(l: Layout, p: Pt): number {
  let best = -1;
  let bestD = Infinity;
  const reach = l.size * 0.62; // generous: a child's finger is not precise
  l.spots.forEach((s, i) => {
    // body centre sits half a body above the feet
    const d = Math.hypot(p.x - s.x, p.y - (s.y - l.size * 0.5));
    if (d < reach && d < bestD) { best = i; bestD = d; }
  });
  return best;
}

/** Index of the tray slot under a point (taking scroll into account), or -1. */
export function slotAt(l: Layout, p: Pt, scrollX: number): number {
  if (p.y < l.tray.y) return -1;
  let best = -1;
  l.slotPos.forEach((s, i) => {
    if (Math.abs(p.x - (s.x - scrollX)) <= l.slot / 2 && Math.abs(p.y - s.y) <= Math.max(l.slot, l.tray.h) / 2) best = i;
  });
  return best;
}

/** Index of a creature standing on a spot (hit test on its body), or -1. */
export function standingAt(l: Layout, p: Pt, occupied: readonly boolean[]): number {
  let best = -1;
  l.spots.forEach((s, i) => {
    if (!occupied[i]) return;
    if (Math.abs(p.x - s.x) <= l.size * 0.55 && p.y <= s.y + l.size * 0.1 && p.y >= s.y - l.size * 1.2) best = i;
  });
  return best;
}

export interface PopupRects { panel: Rect; slider: Rect; solo: Rect }

/** Volume popup that opens beside a creature after a long press: a solo button on top of a vertical slider. */
export function popupRects(l: Layout, spot: number): PopupRects {
  'worklet';
  const sp = l.spots[spot]!;
  const w = Math.max(52, 0.3 * l.size);
  const onRight = spot < l.spots.length / 2; // open toward the middle of the screen
  const x = onRight ? sp.x + l.size * 0.55 : sp.x - l.size * 0.55 - w;
  const sliderH = Math.max(0.75 * l.size, 96);
  const bottom = sp.y;
  const solo: Rect = { x, y: bottom - sliderH - w - 8, w, h: w };
  const slider: Rect = { x, y: bottom - sliderH, w, h: sliderH };
  const panel: Rect = { x: x - 6, y: solo.y - 6, w: w + 12, h: sliderH + w + 8 + 12 };
  return { panel, slider, solo };
}
export const inRect = (r: Rect, p: Pt): boolean => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
