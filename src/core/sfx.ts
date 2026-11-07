import type { Stage } from './types';
import { pitchClass } from './music';

const SEMIS = { major: [0, 2, 4, 7, 9, 12], minor: [0, 3, 5, 7, 10, 12] } as const;
const REF_PC = 9; // the pop sample is recorded on A

/** Playback-rate ratio that makes the drop "pop" of spot `spot` (0..5) a note of the stage's pentatonic scale. */
export function popRate(key: Stage['key'], spot: number): number {
  const scale = SEMIS[key.mode];
  const base = (pitchClass(key.root) - REF_PC + 12) % 12;
  // One octave shift for the whole key (so the six notes keep rising): choose the one that centres the notes near the sample's pitch.
  const mean = base + 6.7;
  const shift = Math.abs(mean - 12 - 2) < Math.abs(mean - 2) ? 12 : 0;
  const semis = base + scale[Math.max(0, Math.min(5, spot))]! - shift;
  return Math.pow(2, semis / 12);
}
