import type { Combo } from './types';
import { TUNING } from './tuning';
import { audibleIds, type StageState } from './stageState';

/** Combos whose 4 creatures are all on stage and unmuted. Off while soloing. */
export function matchingCombos(combos: readonly Combo[], s: StageState): Combo[] {
  if (s.solo) return [];
  const live = new Set(audibleIds(s));
  return combos.filter((c) => c.creatureIds.every((id) => live.has(id)));
}

/** How many of a combo's creatures are currently on stage (honest hint: 0..4). */
export function comboProgress(combo: Combo, s: StageState): number {
  const on = new Set(audibleIds(s));
  return combo.creatureIds.filter((id) => on.has(id)).length;
}

export interface TrackerState {
  candidate: string | null; // combo id being held
  heldBars: number;
  celebrating: { comboId: string; barsLeft: number } | null;
  locked: string | null; // a combo that just played will not fire again until it has been broken
}
export const initialTracker = (): TrackerState => ({ candidate: null, heldBars: 0, celebrating: null, locked: null });

export interface TrackerResult {
  state: TrackerState;
  started: string | null; // combo id whose celebration starts on this bar
  ended: boolean;
}

/**
 * Called once per bar boundary (barIndex = global bar count) with the matching combos.
 * A combo must be held for a full loop, then the celebration starts on a loop boundary.
 */
export function stepTracker(t: TrackerState, barIndex: number, matching: readonly Combo[]): TrackerResult {
  if (t.celebrating) {
    const barsLeft = t.celebrating.barsLeft - 1;
    if (barsLeft <= 0) return { state: { ...initialTracker(), locked: t.celebrating.comboId }, started: null, ended: true };
    return { state: { ...t, celebrating: { ...t.celebrating, barsLeft } }, started: null, ended: false };
  }
  const locked = t.locked !== null && matching.some((c) => c.id === t.locked) ? t.locked : null;
  const usable = matching.filter((c) => c.id !== locked);
  const first = usable[0];
  if (!first) return { state: { ...initialTracker(), locked }, started: null, ended: false };
  const keep = t.candidate !== null && usable.some((c) => c.id === t.candidate);
  const candidate = keep ? t.candidate : first.id;
  const heldBars = keep ? t.heldBars + 1 : 1;
  const needed = TUNING.loopBars * TUNING.comboWaitLoops;
  if (heldBars >= needed && (barIndex + 1) % TUNING.loopBars === 0) {
    // start on the next loop boundary so the bonus loop is in phase
    return {
      state: { candidate: null, heldBars: 0, celebrating: { comboId: candidate!, barsLeft: TUNING.celebrationBars }, locked },
      started: candidate,
      ended: false,
    };
  }
  return { state: { candidate, heldBars, celebrating: null, locked }, started: null, ended: false };
}
