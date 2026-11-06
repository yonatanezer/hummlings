import type { ChordSlot, Layer, Stage } from './types';

const PC: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const pitchClass = (name: string): number => {
  const v = PC[name];
  if (v === undefined) throw new Error(`unknown note ${name}`);
  return v;
};
export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

const CHORD_INTERVALS: Record<ChordSlot['quality'], number[]> = {
  maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10],
};
const PENTATONIC = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] } as const;

export const chordPitchClasses = (c: ChordSlot): number[] => CHORD_INTERVALS[c.quality].map((i) => (pitchClass(c.root) + i) % 12);
export const scalePitchClasses = (key: Stage['key']): number[] => PENTATONIC[key.mode].map((i) => (pitchClass(key.root) + i) % 12);

/** All MIDI notes in [lo, hi] whose pitch class is in `pcs`, ascending. */
export function notesIn(pcs: readonly number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
}

/** Register limits per layer (MIDI). Bass fundamental < 250 Hz, melody > 500 Hz, voice in between. */
export const REGISTER: Record<Exclude<Layer, 'drums'>, { lo: number; hi: number }> = {
  bass: { lo: 28, hi: 58 }, // E1 (41 Hz) .. A#3 (233 Hz)
  voice: { lo: 60, hi: 71 }, // C4 (262 Hz) .. B4 (494 Hz)
  melody: { lo: 72, hi: 91 }, // C5 (523 Hz) .. G6 (1568 Hz)
};
