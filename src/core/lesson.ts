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

/** Level 1: four groups lit one at a time (drag + scroll). Level 2: "my band": silence a singer, wake it, choose one more. Level 3: "volume": lower a singer, raise it, try the star (only this singer). Level 4: "swap": the stage is full; a new singer dropped on one of them takes its place. Level 5: the first secret combo: two of its four singers play, the other two stand as silhouettes. */
export type LessonLevel = 1 | 2 | 3 | 4 | 5;
export const LESSON_LEVELS: readonly LessonLevel[] = [1, 2, 3, 4, 5];
/** What `progress.lessonsDone` holds for a finished level: the bare world id for level 1 (as it always was), `world:2` for level 2. */
export const levelKey = (stageId: string, level: LessonLevel): string => (level === 1 ? stageId : `${stageId}:${level}`);
export type LevelState = 'done' | 'current' | 'locked';
/** The circles of a world's map: finished ones (can be played again), the one that waits (the first not finished), and the ones not open yet. */
export function levelMapStates(stageId: string, done: readonly string[]): { level: LessonLevel; state: LevelState }[] {
  return LESSON_LEVELS.map((level, i) => {
    const finished = done.includes(levelKey(stageId, level));
    const open = i === 0 || done.includes(levelKey(stageId, LESSON_LEVELS[i - 1]!));
    return { level, state: finished ? 'done' : open ? 'current' : 'locked' };
  });
}
/** What entering a world shows: its first level straight away when nothing was played yet (there is nothing to choose), the map after that, nothing for a world without levels. */
export function worldStart(stageId: string, done: readonly string[]): 'play' | 'map' | null {
  if (!hasLesson(stageId)) return null;
  return LESSON_LEVELS.some((l) => done.includes(levelKey(stageId, l))) ? 'map' : 'play';
}
/** The first level of this world that is not finished yet (null: all done, or the world has no levels). */
export function nextLevel(stageId: string, done: readonly string[]): LessonLevel | null {
  if (!hasLesson(stageId)) return null;
  return LESSON_LEVELS.find((l) => !done.includes(levelKey(stageId, l))) ?? null;
}

export const LESSON_LAYERS: readonly Layer[] = LAYERS;
export const LESSON_STEPS = LESSON_LAYERS.length; // level 1: 4
export const LEVEL2_STEPS = 3; // level 2: silence, wake, choose
export const LEVEL3_STEPS = 3; // level 3: lower, raise, star
export const LEVEL4_STEPS = 3; // level 4: three swaps
export const LEVEL5_STEPS = 3; // level 5: the two missing singers, then the combo is found
export const LESSON_COINS = { perStep: 1, finish: { 1: 6, 2: 5, 3: 6, 4: 6, 5: 8 } as Record<LessonLevel, number> } as const;
/** Coin slots in the counter: one per step. */
export const lessonSteps = (level: LessonLevel): number => (level === 1 ? LESSON_STEPS : level === 2 ? LEVEL2_STEPS : level === 3 ? LEVEL3_STEPS : level === 4 ? LEVEL4_STEPS : LEVEL5_STEPS);
export const lessonTotalCoins = (level: LessonLevel = 1): number => lessonSteps(level) * LESSON_COINS.perStep + LESSON_COINS.finish[level];
/** Without a touch for this long the menu slides to the lit group by itself. */
export const LESSON_SCROLL_WAIT_MS = 3500;
/** After the last singer the whole song plays for this long before the success card appears. */
export const LESSON_FINISH_MS = 2800;
/** Level 5 ends with the combo's own celebration, which gets longer before the success card comes. */
export const lessonFinishMs = (level: LessonLevel): number => (level === 5 ? 6500 : LESSON_FINISH_MS);

/** A coin that flies from a singer that just landed to its place in the counter at the top. */
export interface LessonFx { x: number; y: number; t0: number; slot: number }
/** What the scene draws for the lesson (plain data, lives in a shared value). */
export interface LessonView {
  slots: string[]; // colours of the coin slots (their number is the number of steps)
  litIds?: string[]; // level 5: the singers in the menu that are needed (the rest of the menu is dark)
  ghosts?: { id: string; spot: number }[]; // level 5: the missing singers, drawn as grey silhouettes on their places
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
  return level === 1 ? lessonCanPick(stage, step, id) : level === 2 ? step >= 2 : level === 3 ? false : level === 4 ? true : level5Plan(stage).needed.includes(id);
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
  if (level === 4) return { ids: level4Band(stage), spots: LEVEL4_SPOTS };
  if (level === 5) return { ids: level5Plan(stage).band, spots: LEVEL5_BAND_SPOTS };
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


// ---------------- level 4: swap ----------------

/** A full stage: one singer of every group, plus a second drummer and a second melody singer, on all six spots. */
export const level4Band = (stage: Stage): string[] => {
  const of = (layer: Layer, n: number) => stage.creatures.filter((c) => c.layer === layer)[n]!.id;
  return [of('drums', 0), of('bass', 0), of('melody', 0), of('voice', 0), of('drums', 1), of('melody', 1)];
};
export const LEVEL4_SPOTS: readonly number[] = [0, 1, 2, 3, 4, 5];

/** Level 4 is simply the number of swaps made so far (a new singer dropped on a singer that stands on the stage), up to three. */
export const level4Step = (swaps: number): number => Math.min(LEVEL4_STEPS, Math.max(0, swaps));

/** The hand of level 4: carries a singer from the menu onto a singer on stage (a different one each time), which hops back to the menu. */
export function level4Cue(stage: Stage, layout: Layout, scrollX: number, spots: readonly (string | null)[], step: number): CoachCue | null {
  if (step >= LEVEL4_STEPS) return null;
  const placed = new Set(spots.filter((id): id is string => !!id));
  const free = stage.creatures.map((c, i) => i).filter((i) => !placed.has(stage.creatures[i]!.id) && visibleX(layout.slotPos[i]!.x - scrollX, layout.W));
  if (free.length === 0) return { kind: 'swipe', slot: 0, spot: 0, dir: scrollX < layout.scrollMax / 2 ? 1 : -1 };
  const occupied = spots.map((id, i) => (id ? i : -1)).filter((i) => i >= 0);
  if (occupied.length === 0) return null;
  const spot = occupied[(step * 2) % occupied.length]!;
  const layer = stage.creatures.find((c) => c.id === spots[spot])?.layer;
  const same = free.filter((i) => stage.creatures[i]!.layer === layer); // the same kind of singer: the song keeps its shape, only the voice changes
  const pool = same.length ? same : free;
  return { kind: 'drag', slot: pool[Math.floor((pool.length - 1) / 2)]!, spot };
}

// ---------------- level 5: the first secret combo ----------------

export const LEVEL5_BAND_SPOTS: readonly number[] = [1, 2];
export const LEVEL5_GHOST_SPOTS: readonly number[] = [3, 4];

const level5State = { index: 1 }; // which of the world's combos the level uses (the second one: the first did not sound good enough)
/** Chooses the combo of level 5 by its place in the world's list (the web demo uses it to let a listener try them all). */
export const setLevel5Combo = (index: number): void => { level5State.index = Math.max(0, Math.floor(index)); };
/** One of the world's combos: its first two singers play from the start, the other two have to be found (their silhouettes stand on their places). */
export function level5Plan(stage: Stage): { comboId: string; band: string[]; needed: string[] } {
  const combo = stage.combos[level5State.index] ?? stage.combos[0]!;
  const ids = [...combo.creatureIds] as string[];
  return { comboId: combo.id, band: ids.slice(0, 2), needed: ids.slice(2) };
}
/** The needed singers that are not on stage yet. */
export const level5Missing = (stage: Stage, spots: readonly (string | null)[]): string[] => level5Plan(stage).needed.filter((id) => !spots.includes(id));
export const level5Ghosts = (stage: Stage, spots: readonly (string | null)[]): { id: string; spot: number }[] => {
  const { needed } = level5Plan(stage);
  return level5Missing(stage, spots).map((id) => ({ id, spot: LEVEL5_GHOST_SPOTS[needed.indexOf(id)]! }));
};
/** 0, 1: how many of the two missing singers are on stage; 2: both are, the combo is held; 3: the combo was found (its celebration began). `found` is remembered by the screen. */
export function level5Step(stage: Stage, spots: readonly (string | null)[], found: boolean): number {
  const n = level5Plan(stage).needed.length - level5Missing(stage, spots).length;
  return n >= 2 ? (found ? 3 : 2) : n;
}
/** Where the menu has to go so that this slot is on screen (null: it already is). */
export function slotScrollTarget(layout: Layout, scrollX: number, slot: number): number | null {
  if (visibleX(layout.slotPos[slot]!.x - scrollX, layout.W)) return null;
  return Math.max(0, Math.min(layout.scrollMax, layout.slotPos[slot]!.x - layout.W / 2));
}
/** The hand of level 5: carries the next missing singer onto its silhouette (or slides the menu towards it when it is out of sight); nothing while the combo is being held. */
export function level5Cue(stage: Stage, layout: Layout, scrollX: number, spots: readonly (string | null)[]): CoachCue | null {
  const { needed } = level5Plan(stage);
  const id = level5Missing(stage, spots)[0];
  if (!id) return null;
  const slot = stage.creatures.findIndex((c) => c.id === id);
  if (visibleX(layout.slotPos[slot]!.x - scrollX, layout.W)) return { kind: 'drag', slot, spot: LEVEL5_GHOST_SPOTS[needed.indexOf(id)]! };
  return { kind: 'swipe', slot, spot: 0, dir: layout.slotPos[slot]!.x - scrollX > layout.W / 2 ? 1 : -1 };
}
