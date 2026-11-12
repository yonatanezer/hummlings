import { TUNING } from './tuning';

/** Immediate (visual) state of the stage. Audible state is derived from it at bar boundaries. */
export interface StageState {
  spots: (string | null)[]; // creature id per spot, length TUNING.maxSpots
  muted: Record<string, true>;
  solo: string | null;
  volume: Record<string, number>; // per-creature level 0..1 (missing = 1)
}

export type StageAction =
  | { kind: 'drop'; creatureId: string; spot: number }
  | { kind: 'remove'; creatureId: string }
  | { kind: 'mute'; creatureId: string } // toggles
  | { kind: 'solo'; creatureId: string } // toggles
  | { kind: 'endSolo' }
  | { kind: 'volume'; creatureId: string; value: number } // set level (long-press, then drag the slider)
  | { kind: 'clear' };

export const emptyStage = (): StageState => ({
  spots: Array.from({ length: TUNING.maxSpots }, () => null),
  muted: {},
  solo: null,
  volume: {},
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
      const volume = { ...s.volume };
      if (!s.spots.includes(a.creatureId)) delete volume[a.creatureId]; // arriving from the tray starts at full level; moving keeps it
      if (old) delete volume[old];
      return { spots, muted, solo, volume };
    }
    case 'remove': {
      if (!isOnStage(s, a.creatureId)) return s;
      const muted = { ...s.muted };
      delete muted[a.creatureId];
      const volume = { ...s.volume };
      delete volume[a.creatureId];
      return {
        spots: s.spots.map((x) => (x === a.creatureId ? null : x)),
        muted,
        solo: s.solo === a.creatureId ? null : s.solo,
        volume,
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
    case 'volume': {
      if (!isOnStage(s, a.creatureId)) return s;
      const v = Math.min(1, Math.max(0, a.value));
      if ((s.volume[a.creatureId] ?? 1) === v) return s;
      return { ...s, volume: { ...s.volume, [a.creatureId]: v } };
    }
    case 'endSolo':
      return s.solo ? { ...s, solo: null } : s;
    case 'clear':
      return emptyStage();
  }
}

/** A singer turned all the way down counts as silent (like a mute) for the mix, combos and stickers. */
export const SILENT_LEVEL = 0.03;

/** Ids that make sound at a bar boundary. */
export function audibleIds(s: StageState): string[] {
  if (s.solo) return isOnStage(s, s.solo) ? [s.solo] : [];
  return onStage(s).filter((id) => !s.muted[id] && (s.volume[id] ?? 1) >= SILENT_LEVEL);
}

/** Order in which a tapped singer takes a spot: the middle of the stage first, then outward. */
const SPOT_ORDER = [2, 3, 1, 4, 0, 5];
export const nextFreeSpot = (s: StageState): number => SPOT_ORDER.find((i) => i < s.spots.length && !s.spots[i]) ?? -1;
