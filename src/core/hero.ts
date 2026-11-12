/** The six singers of the home screen and the notes they sing (shared by the app and the web demo). */
/** Notes the six singers play when touched: a major pentatonic scale (C D E G A C), as playback-rate ratios of one sound. */
export const HERO_NOTES: readonly number[] = [1, 1.122, 1.26, 1.498, 1.682, 2];
export const HERO_COUNT = 6;
/** Which creatures of the first world stand on the hill (one per colour group, spread so the row is colourful). */
export const HERO_PICKS: readonly number[] = [0, 5, 10, 2, 7, 13];

export interface HeroGeo {
  top: number; // y of the hero zone in the screen
  height: number; // height of the hero zone
  S: number; // creature size
  xs: number[]; // centre x of each singer (zone coordinates)
  ys: number[]; // feet y of each singer (zone coordinates)
}

/** Where the singers stand. Shared by the intro and the home screen so the creatures that land in the intro are exactly the ones on the home screen. */
export function heroGeometry(width: number, height: number, topBarH: number, insetL: number, insetR: number): HeroGeo {
  const avail = Math.max(120, height - topBarH);
  const zoneH = Math.min(240, Math.max(92, avail * 0.4));
  const usable = Math.max(240, width - insetL - insetR - 24);
  const S = Math.min(zoneH * 0.6, usable / 6.4);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < HERO_COUNT; i++) {
    const t = (i + 0.5) / HERO_COUNT;
    xs.push(insetL + 12 + usable * t);
    ys.push(zoneH * 0.9 - Math.sin(Math.PI * t) * S * 0.16);
  }
  return { top: topBarH - 4, height: zoneH, S, xs, ys };
}

/** The geometry for the drawing canvas: it starts `pad` above the singers' zone (the tallest singer's ears reach above it) and runs down to `totalH`. */
export function paddedGeo(g: HeroGeo, totalH: number): { geo: HeroGeo; pad: number } {
  const pad = Math.round(g.S * 0.5);
  return { geo: { ...g, ys: g.ys.map((y) => y + pad), height: Math.max(g.height, totalH) + pad }, pad };
}

export interface HeroHit { i: number; t: number }

/** Index of the singer under a touch (zone coordinates), or -1. Generous: a child's finger is not precise. */
export function heroHitTest(g: HeroGeo, x: number, y: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < g.xs.length; i++) {
    const dx = Math.abs(x - g.xs[i]!);
    const cy = g.ys[i]! - g.S * 0.5;
    const d = Math.hypot(dx, (y - cy) * 0.8);
    if (dx < g.S * 0.62 && d < g.S * 0.85 && d < bestD) { best = i; bestD = d; }
  }
  return best;
}
