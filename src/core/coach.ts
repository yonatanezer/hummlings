/**
 * The wordless coach: an animated hand that shows what to do next, for children who cannot read.
 * Pure rules (no UI): what to show, which tray singer to move and where to.
 */
export type CoachKind = 'drag' | 'tap';
export interface CoachCue { kind: CoachKind; slot: number; spot: number }

export interface CoachInput {
  onStage: number; // singers on the stage
  firstDropDone: boolean;
  moreDone: boolean; // the player has had at least three singers on stage once
  tapDone: boolean; // the player has tapped a singer once (to silence or wake it)
  idleMs: number; // since the last touch
}

export const COACH_IDLE_MS = { more: 4000, tap: 5000, again: 9000 } as const;

/**
 * 1. Nobody on stage: the very first time the hand shows at once; later only after a long pause.
 * 2. One or two on stage and never reached three: after a short pause the hand moves another one.
 * 3. Three or more reached but a tap never tried: the hand taps a singer.
 * Anything else: no coaching.
 */
export function coachKind(i: CoachInput): CoachKind | null {
  if (i.onStage === 0) return !i.firstDropDone || i.idleMs >= COACH_IDLE_MS.again ? 'drag' : null;
  if (!i.moreDone && i.onStage < 3) return i.idleMs >= COACH_IDLE_MS.more ? 'drag' : null;
  if (i.moreDone && !i.tapDone && i.onStage >= 2) return i.idleMs >= COACH_IDLE_MS.tap ? 'tap' : null;
  return null;
}

/** Spots in the order the hand uses them: the middle of the stage first. */
export const COACH_SPOT_ORDER: readonly number[] = [2, 3, 1, 4, 0, 5];

/** The first tray slot (in tray order) whose singer is not on stage and whose slot is on screen. `slotX` is the screen x of each slot. */
export function pickSlot(creatureIds: readonly string[], placed: ReadonlySet<string>, slotX: readonly number[], width: number): number {
  const visible = (x: number) => x > width * 0.06 && x < width * 0.94;
  const free = creatureIds.map((id, i) => i).filter((i) => !placed.has(creatureIds[i]!));
  return free.find((i) => visible(slotX[i]!)) ?? free[0] ?? 0;
}

/** The first free spot in the coach's order, or the first spot. */
export function pickSpot(spots: readonly (string | null)[]): number {
  return COACH_SPOT_ORDER.find((i) => !spots[i]) ?? 0;
}

/** A singer to tap: the first one on stage that is not silenced (or any). */
export function pickTapSpot(spots: readonly (string | null)[], muted: Readonly<Record<string, true>>): number {
  const order = COACH_SPOT_ORDER.filter((i) => spots[i]);
  return order.find((i) => !muted[spots[i]!]) ?? order[0] ?? 0;
}
