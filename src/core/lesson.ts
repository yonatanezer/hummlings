/**
 * Level 1 of every world: the guided first lesson. Pure rules, no UI.
 *
 * The singer menu has four groups (drums, bass, melody, voice). Only one group is lit at a time and the others are dark and cannot be touched:
 * the child must carry one singer of the lit group onto the stage, then the next group lights up (the menu slides to it when it is out of sight), and so on.
 * The lesson step is never stored: it is simply how many of the four groups already have a singer on stage, in order.
 */
import type { CoachCue } from './coach';
import { COACH_SPOT_ORDER } from './coach';
import type { Layout } from './layout';
import { LAYERS, type Layer, type Stage } from './types';

/** Only the first world has levels for now; the other worlds stay in free play. */
export const LESSON_STAGE_IDS: readonly string[] = ['pond'];
export const hasLesson = (stageId: string): boolean => LESSON_STAGE_IDS.includes(stageId);

/** Level 1: four groups lit one at a time (drag + scroll). Level 2: "my band": silence a singer, wake it, choose one more. Level 3: "volume": lower a singer, raise it, try the star (only this singer). */
export type LessonLevel = 1 | 2 | 3;
export const LESSON_LEVELS: readonly LessonLevel[] = [1, 2, 3];
/** What `progress.lessonsDone` holds for a finished level: the bare world id for level 1 (as it always was), `world:2` for level 2. */
export const levelKey = (stageId: string, level: LessonLevel): string => (level === 1 ? stageId : `${stageId}:${level}`);
/** The first level of this world that is not finished yet (null: all done, or the world has no levels). */
export function nextLevel(stageId: string, done: readonly string[]): LessonLevel | null {
  if (!hasLesson(stageId)) return null;
  return LESSON_LEVELS.find((l) => !done.includes(levelKey(stageId, l))) ?? null;
}

export const LESSON_LAYERS: readonly Layer[] = LAYERS;
export const LESSON_STEPS = LESSON_LAYERS.length; // level 1: 4
export const LEVEL2_STEPS = 3; // level 2: silence, wake, choose
export const LEVEL3_STEPS = 3; // level 3: lower, raise, star
export const LESSON_COINS = { perStep: 1, finish: { 1: 6, 2: 5, 3: 6 } as Record<LessonLevel, number> } as const;
/** Coin slots in the counter: one per step. */
export const lessonSteps = (level: LessonLevel): number => (level === 1 ? LESSON_STEPS : level === 2 ? LEVEL2_STEPS : LEVEL3_STEPS);
export const lessonTotalCoins = (level: LessonLevel = 1): number => lessonSteps(level) * LESSON_COINS.perStep + LESSON_COINS.finish[level];
/** Without a touch for this long the menu slides to the lit group by itself. */
export const LESSON_SCROLL_WAIT_MS = 3500;
/** After the last singer the whole song plays for this long before the success card appears. */
export const LESSON_FINISH_MS = 2800;

/** A coin that flies from a singer that just landed to its place in the counter at the top. */
export interface LessonFx { x: number; y: number; t0: number; slot: number }
/** What the scene draws for the lesson (plain data, lives in a shared value). */
export interface LessonView {
  slots: string[]; // colours of the coin slots (their number is the number of steps)
  dim: boolean; // every group in the menu is dark (level 2 before the menu is needed)
  lit: Layer | null; // the group that is lit (null: no group is singled out)
  prev: Layer | null; // the group that was lit just before (it fades dark)
  since: number; // scene time at which this group lit up
  done: number; // groups already on stage (filled coins)
  topY: number; // vertical centre of the coin counter
  fx: LessonFx[];
}

const layerOf = (stage: Stage, id: string): Layer | undefined => stage.creatures.find((c) => c.id === id)?.layer;

/** 0..4: how many groups, in order, already have a singer on stage. 4 = the lesson is complete. */
export function lessonStep(stage: Stage, spots: readonly (string | null)[]): number {
  const have = new Set<Layer>();
  for (const id of spots) { if (id) { const l = layerOf(stage, id); if (l) have.add(l); } }
  let step = 0;
  while (step < LESSON_STEPS && have.has(LESSON_LAYERS[step]!)) step++;
  return step;
}

export const lessonLit = (step: number): Layer | null => LESSON_LAYERS[step] ?? null;

/** Only singers of the lit group may be picked up. */
export const lessonCanPick = (stage: Stage, step: number, id: string): boolean => {
  const lit = lessonLit(step);
  return lit !== null && layerOf(stage, id) === lit;
};

/** First tray slots of a group (the group is `per` consecutive creatures). */
const groupRange = (stage: Stage, layer: Layer): { first: number; last: number } => {
  const per = stage.creatures.length / LESSON_STEPS;
  const g = LESSON_LAYERS.indexOf(layer);
  return { first: g * per, last: g * per + per - 1 };
};

const visibleX = (x: number, W: number): boolean => x > W * 0.06 && x < W * 0.94;

/** The tray slots of the lit group that are on screen now. */
export function litSlotsOnScreen(stage: Stage, layout: Layout, scrollX: number, layer: Layer): number[] {
  const { first, last } = groupRange(stage, layer);
  const out: number[] = [];
  for (let i = first; i <= last; i++) if (visibleX(layout.slotPos[i]!.x - scrollX, layout.W)) out.push(i);
  return out;
}

/** Where the menu has to scroll so that the lit group is on screen, or null when part of it already is. */
export function lessonScrollTarget(stage: Stage, layout: Layout, scrollX: number, layer: Layer): number | null {
  if (litSlotsOnScreen(stage, layout, scrollX, layer).length > 0) return null;
  const { first } = groupRange(stage, layer);
  const target = layout.slotPos[first]!.x - layout.slot * 0.55 - Math.max(16, layout.W * 0.04);
  return Math.max(0, Math.min(layout.scrollMax, target));
}

/** Which way the lit group lies (1: to the right, -1: to the left, 0: on screen). */
export function lessonDirection(stage: Stage, layout: Layout, scrollX: number, layer: Layer): -1 | 0 | 1 {
  if (litSlotsOnScreen(stage, layout, scrollX, layer).length > 0) return 0;
  const { first } = groupRange(stage, layer);
  return layout.slotPos[first]!.x - scrollX > layout.W / 2 ? 1 : -1;
}

/** The hand of the lesson: drag the first visible singer of the lit group to the first free spot, or swipe the menu towards the lit group. */
export function lessonCue(stage: Stage, layout: Layout, scrollX: number, spots: readonly (string | null)[], step: number): CoachCue | null {
  const lit = lessonLit(step);
  if (!lit) return null;
  const slots = litSlotsOnScreen(stage, layout, scrollX, lit);
  if (slots.length === 0) return { kind: 'swipe', slot: 0, spot: 0, dir: lessonDirection(stage, layout, scrollX, lit) === -1 ? -1 : 1 };
  const spot = COACH_SPOT_ORDER.find((i) => !spots[i]) ?? 0;
  return { kind: 'drag', slot: slots[Math.floor((slots.length - 1) / 2)]!, spot };
}

// ---------------- level 2: my band ----------------

/** The ready-made band: the first singer of the drums, bass and melody groups, on spots 1, 2 and 3. */
export const level2Band = (stage: Stage): string[] => LESSON_LAYERS.slice(0, 3).map((l) => stage.creatures.find((c) => c.layer === l)!.id);
export const LEVEL2_SPOTS: readonly number[] = [1, 2, 3];

/**
 * 0: silence a singer (a tap), 1: wake it (a tap), 2: choose one more singer (any), 3: done (four on stage).
 * `silenced` is remembered by the screen (once a singer was silenced): after it is woken nothing on stage shows it any more.
 */
export function level2Step(spots: readonly (string | null)[], muted: Readonly<Record<string, true | undefined>>, silenced: boolean): number {
  if (!silenced) return 0;
  if (spots.some((id) => !!id && muted[id])) return 1;
  return spots.filter(Boolean).length >= 4 ? 3 : 2;
}

/** The hand of level 2: taps the singer to silence, taps it again to wake it, then drags any visible singer onto the stage. */
export function level2Cue(stage: Stage, layout: Layout, scrollX: number, spots: readonly (string | null)[], muted: Readonly<Record<string, true | undefined>>, step: number): CoachCue | null {
  if (step >= 3) return null;
  if (step === 0) {
    const spot = Math.max(spots.indexOf(level2Band(stage)[0]!), spots.findIndex(Boolean));
    return spot < 0 ? null : { kind: 'tap', slot: -1, spot };
  }
  if (step === 1) {
    const spot = spots.findIndex((id) => !!id && !!muted[id]);
    return spot < 0 ? null : { kind: 'tap', slot: -1, spot };
  }
  const placed = new Set(spots.filter((id): id is string => !!id));
  const free = stage.creatures.map((c, i) => i).filter((i) => !placed.has(stage.creatures[i]!.id) && visibleX(layout.slotPos[i]!.x - scrollX, layout.W));
  if (free.length === 0) return { kind: 'swipe', slot: 0, spot: 0, dir: scrollX < layout.scrollMax / 2 ? 1 : -1 };
  const voice = free.filter((i) => stage.creatures[i]!.layer === 'voice'); // the group the band does not have yet
  const pool = voice.length ? voice : free;
  return { kind: 'drag', slot: pool[Math.floor((pool.length - 1) / 2)]!, spot: COACH_SPOT_ORDER.find((i) => !spots[i]) ?? 0 };
}

/** What may be picked up from the menu: level 1 the lit group only; level 2 nothing until the third step, then anything; level 3 nothing. */
export function lessonPickable(level: LessonLevel, stage: Stage, step: number, id: string): boolean {
  return level === 1 ? lessonCanPick(stage, step, id) : level === 2 ? step >= 2 : false;
}

// ---------------- level 3: volume ----------------

/** The ready-made band of level 3: the first singer of every group, on spots 1 to 4. */
export const level3Band = (stage: Stage): string[] => LESSON_LAYERS.map((l) => stage.creatures.find((c) => c.layer === l)!.id);
export const LEVEL3_SPOTS: readonly number[] = [1, 2, 3, 4];
/** A volume under this counts as "lowered"; every singer has to be back at or above LOUD_FROM for "raised". */
export const QUIET_BELOW = 0.5;
export const LOUD_FROM = 0.75;

/** The band and its spots for a level that starts with a ready-made band (null: that level starts from an empty stage). */
export function levelBand(level: LessonLevel, stage: Stage): { ids: string[]; spots: readonly number[] } | null {
  if (level === 2) return { ids: level2Band(stage), spots: LEVEL2_SPOTS };
  if (level === 3) return { ids: level3Band(stage), spots: LEVEL3_SPOTS };
  return null;
}

/**
 * 0: lower a singer's volume (a long press opens the slider), 1: raise it again, 2: try the star ("only this singer"), 3: done (solo is on).
 * `quiet` is remembered by the screen (a volume went under QUIET_BELOW once): after it is raised nothing shows it any more.
 */
export function level3Step(spots: readonly (string | null)[], volume: Readonly<Record<string, number>>, solo: string | null, quiet: boolean): number {
  if (!quiet) return 0;
  if (spots.some((id) => !!id && (volume[id] ?? 1) < LOUD_FROM)) return 1;
  return solo !== null ? 3 : 2;
}

/** The hand of level 3: holds a singer (the slider opens), slides the slider down and then up, then taps the star. */
export function level3Cue(stage: Stage, spots: readonly (string | null)[], volume: Readonly<Record<string, number>>, popup: { spot: number } | null, step: number): CoachCue | null {
  if (step >= 3) return null;
  const first = Math.max(spots.indexOf(level3Band(stage)[0]!), spots.findIndex(Boolean));
  if (first < 0) return null;
  if (step === 2) return popup ? { kind: 'solo', slot: -1, spot: popup.spot } : { kind: 'hold', slot: -1, spot: first };
  if (step === 0) return popup ? { kind: 'slide', slot: -1, spot: popup.spot, dir: 1 } : { kind: 'hold', slot: -1, spot: first, dir: 1 };
  const low = spots.findIndex((id) => !!id && (volume[id] ?? 1) < LOUD_FROM);
  return popup ? { kind: 'slide', slot: -1, spot: popup.spot, dir: -1 } : { kind: 'hold', slot: -1, spot: low < 0 ? first : low, dir: -1 };
}

