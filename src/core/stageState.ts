import { TUNING } from './tuning';

/** Immediate (visual) state of the stage. Audible state is derived from it at bar boundaries. */
export interface StageState {
  spots: (string | null)[]; // creature id per spot, length TUNING.maxSpots
  muted: Record<string, true>;
  solo: string | null;
}

export type StageAction =
  | { kind: 'drop'; creatureId: string; spot: number }
  | { kind: 'remove'; creatureId: string }
  | { kind: 'mute'; creatureId: string } // toggles
  | { kind: 'solo'; creatureId: string } // toggles
  | { kind: 'endSolo' }
  | { kind: 'clear' };

export const emptyStage = (): StageState => ({
  spots: Array.from({ length: TUNING.maxSpots }, () => null),
  muted: {},
  solo: null,
});

export const onStage = (s: StageState): string[] => s.spots.filter((x): x is string => x !== null);
export const isOnStage = (s: StageState, id: string): boolean => s.spots.includes(id);

/** The creature that a drop on `spot` would push back to the tray (null if none). */
export const displacedBy = (s: StageState, spot: number): string | null => s.spots[spot] ?? null;

export function reduceStage(s: StageState, a: StageAction): StageState {
  switch (a.kind) {
    case 'drop': {
      if (a.spot < 0 || a.spot >= s.spots.length) return s;
      const spots = s.spots.map((x) => (x === a.creatureId ? null : x));
      const old = spots[a.spot];
      spots[a.spot] = a.creatureId;
      const muted = { ...s.muted };
      delete muted[a.creatureId]; // a creature that arrives is never muted
      let solo = s.solo;
      if (old) {
        delete muted[old];
        if (solo === old) solo = null;
      }
      return { spots, muted, solo };
    }
    case 'remove': {
      if (!isOnStage(s, a.creatureId)) return s;
      const muted = { ...s.muted };
      delete muted[a.creatureId];
      return {
        spots: s.spots.map((x) => (x === a.creatureId ? null : x)),
        muted,
        solo: s.solo === a.creatureId ? null : s.solo,
      };
    }
    case 'mute': {
      if (!isOnStage(s, a.creatureId)) return s;
      const muted = { ...s.muted };
      if (muted[a.creatureId]) delete muted[a.creatureId];
      else muted[a.creatureId] = true;
      // Muting the soloist ends the solo.
      return { ...s, muted, solo: s.solo === a.creatureId ? null : s.solo };
    }
    case 'solo': {
      if (!isOnStage(s, a.creatureId)) return s;
      if (s.solo === a.creatureId) return { ...s, solo: null };
      const muted = { ...s.muted };
      delete muted[a.creatureId]; // solo on a muted creature unmutes it
      return { ...s, muted, solo: a.creatureId };
    }
    case 'endSolo':
      return s.solo ? { ...s, solo: null } : s;
    case 'clear':
      return emptyStage();
  }
}

/** Ids that make sound at a bar boundary. */
export function audibleIds(s: StageState): string[] {
  if (s.solo) return isOnStage(s, s.solo) ? [s.solo] : [];
  return onStage(s).filter((id) => !s.muted[id]);
}
