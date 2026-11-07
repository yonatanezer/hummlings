import type { Stage } from './types';
import { pitchClass } from './music';

const SEMIS = { major: [0, 2, 4, 7, 9, 12], minor: [0, 3, 5, 7, 10, 12] } as const;
const REF_PC = 9; // the pop sample is recorded on A

/** Playback-rate ratio that makes the drop "pop" of spot `spot` (0..5) a note of the stage's pentatonic scale. */
export function popRate(key: Stage['key'], spot: number): number {
  const degree = SEMIS[key.mode][Math.max(0, Math.min(5, spot))]!;
  let semis = ((pitchClass(key.root) - REF_PC + 12) % 12) + degree;
  if (semis > 7) semis -= 12; // keep within a fifth either side of the sample for a clean sound
  return Math.pow(2, semis / 12);
}
