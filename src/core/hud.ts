import type { Layer, Stage } from './types';
import { LAYERS } from './types';
import type { StageState } from './stageState';

export interface HudModel {
  layers: Record<Layer, boolean>; // a singer of this kind is audible right now
  best: { have: number } | null; // the not-yet-found combo with the most of its singers on stage (null once all are found)
  found: number;
  total: number;
}

/** What the two top pills show (same rules as the web demo): audible layers, nearest secret combo, combos found. */
export function hudModel(stage: Stage, state: StageState, discovered: readonly string[]): HudModel {
  const live = new Set(state.solo ? [state.solo] : state.spots.filter((x): x is string => !!x && !state.muted[x]));
  const layers = Object.fromEntries(LAYERS.map((l) => [l, stage.creatures.some((c) => c.layer === l && live.has(c.id))])) as Record<Layer, boolean>;
  const on = new Set(state.spots.filter((x): x is string => !!x).filter((x) => !state.muted[x] && (state.volume[x] ?? 1) >= 0.03));
  const have = (ids: readonly string[]) => (state.solo ? 0 : ids.filter((id) => on.has(id)).length);
  const open = stage.combos.filter((c) => !discovered.includes(c.id));
  let best: HudModel['best'] = null;
  for (const c of open) { const h = have(c.creatureIds); if (!best || h > best.have) best = { have: h }; }
  return { layers, best, found: stage.combos.length - open.length, total: stage.combos.length };
}
