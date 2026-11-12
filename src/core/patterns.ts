import { chordPitchClasses, notesIn, REGISTER, scalePitchClasses } from './music';
import type { ChordSlot, Layer, Stage } from './types';
import { TUNING } from './tuning';

export type DrumKind = 'kick' | 'snare' | 'hat' | 'openhat' | 'clap' | 'shaker' | 'tom' | 'wood';
export type Syllable = 'doo' | 'bah' | 'la' | 'hey';

export interface NoteEvent {
  beat: number; // 0..16 within the 4-bar loop
  dur: number; // beats
  vel: number; // 0..1
  midi?: number; // pitched layers
  drum?: DrumKind; // drums
  syl?: Syllable; // voice
}

/** Small deterministic PRNG (mulberry32) so content builds are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Ctx {
  chords: ChordSlot[];
  scale: number[];
  rand: () => number;
  variant: number; // 0..perLayer-1
  swing: number; // 0..0.3 of an 8th
  world: number; // stage index: selects the melodic contour family so each world has its own tunes
}
const bars = TUNING.loopBars;
const B = TUNING.beatsPerBar;

/** Rhythm cells (beat, duration) for one bar and melodic contours (pentatonic steps) for 4 bars: call, answer, call, resolve.
 *  rhythm = variant, contour = world, so every melody creature of every world is a different tune. */
const RHYTHMS: [number, number][][] = [
  [[0, 0.75], [0.75, 0.75], [1.5, 0.5], [2, 1], [3, 1]],
  [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1.5], [3.5, 0.5]],
  [[0.5, 0.5], [1, 0.5], [2, 0.5], [2.5, 1], [3.5, 0.5]],
  [[0, 0.5], [0.5, 0.5], [1, 1], [2.5, 0.5], [3, 1]],
];
const CONTOURS: number[][][] = [
  [[0, 1, 2, 1, 0], [2, 3, 2, 1, 2], [0, 1, 3, 2, 1], [3, 2, 1, 0, -1]], // rising question, falling answer
  [[2, 2, 3, 2, 0], [1, 1, 2, 1, -1], [2, 3, 4, 3, 2], [3, 1, 2, 0, 0]], // repeated notes with leaps
  [[0, 2, 1, 3, 2], [4, 3, 2, 1, 2], [0, 2, 4, 3, 1], [2, 1, 0, 1, 0]], // wide skips, gentle landing
  [[4, 3, 2, 3, 4], [2, 1, 2, 3, 1], [3, 4, 2, 3, 0], [1, 0, -1, 0, 1]], // arches that lean downward
  [[0, 0, 2, 2, 1], [3, 3, 1, 1, 0], [1, 2, 3, 4, 3], [2, 1, 0, -1, 0]], // paired notes, like a chant
];
/** Notes of one bar of the composed tune: [beat, duration, pool index]. */
export function tuneBar(world: number, variant: number, bar: number, anchor: number): [number, number, number][] {
  const cell = RHYTHMS[variant % 4]!;
  const steps = CONTOURS[world % CONTOURS.length]![bar % 4]!;
  return cell.map(([b, d], i) => [b, d, anchor + steps[i % steps.length]!]);
}

const nearest = (pool: number[], target: number): number =>
  pool.reduce((best, m) => (Math.abs(m - target) < Math.abs(best - target) ? m : best), pool[0]!);
const pick = <T,>(arr: readonly T[], r: () => number): T => arr[Math.floor(r() * arr.length)]!;
const swung = (beat: number, swing: number): number => (Math.abs(beat % 1 - 0.5) < 1e-6 ? beat + swing * 0.5 : beat);

function drums(c: Ctx): NoteEvent[] {
  const out: NoteEvent[] = [];
  const add = (beat: number, drum: DrumKind, vel: number, dur = 0.25) => out.push({ beat: swung(beat, c.swing), dur, vel, drum });
  for (let bar = 0; bar < bars; bar++) {
    const o = bar * B;
    const last = bar === bars - 1;
    switch (c.variant) {
      case 0: // kick + snare backbone
        add(o, 'kick', 1); add(o + 2, 'kick', 0.9); if (bar % 2) add(o + 2.5, 'kick', 0.6);
        add(o + 1, 'snare', 0.85); add(o + 3, 'snare', 0.85);
        if (last) { add(o + 3.5, 'snare', 0.6); add(o + 3.75, 'snare', 0.7); }
        break;
      case 1: // hats with open-hat offbeats
        for (let i = 0; i < 8; i++) add(o + i * 0.5, i % 2 ? 'openhat' : 'hat', i % 2 ? 0.55 : 0.8, i % 2 ? 0.4 : 0.15);
        if (last) add(o + 3.75, 'hat', 0.7);
        break;
      case 2: // clap on 2 & 4, shaker 16ths, wood accents
        add(o + 1, 'clap', 0.8); add(o + 3, 'clap', 0.8);
        for (let i = 0; i < 16; i++) add(o + i * 0.25, 'shaker', i % 4 === 0 ? 0.6 : 0.3, 0.12);
        if (bar % 2) add(o + 2.75, 'wood', 0.7);
        break;
      case 3: // tom groove with a fill every 4th bar
        add(o, 'tom', 0.9, 0.4); add(o + 1.5, 'tom', 0.7, 0.3); add(o + 2.5, 'tom', 0.75, 0.3);
        if (last) { for (let i = 0; i < 4; i++) add(o + 3 + i * 0.25, 'tom', 0.6 + i * 0.1, 0.2); }
        else add(o + 3, 'wood', 0.5);
        break;
      case 4: // boom-bap: kick on 1 and the "and" of 2, snare on 3, ghost hats
        add(o, 'kick', 1); add(o + 1.5, 'kick', 0.8); add(o + 2, 'snare', 0.9); if (bar % 2) add(o + 3.5, 'kick', 0.6);
        for (let i = 0; i < 8; i++) add(o + i * 0.5, 'hat', i % 2 ? 0.25 : 0.5, 0.1);
        break;
      default: // latin pulse: 3-3-2 wood and shaker with a tom answer
        for (const t of [0, 0.75, 1.5, 2.25, 3]) add(o + t, 'wood', t === 0 ? 0.8 : 0.6);
        for (let i = 0; i < 8; i++) add(o + i * 0.5 + 0.25, 'shaker', 0.35, 0.1);
        add(o + 2, 'tom', 0.7, 0.3); if (last) add(o + 3.5, 'tom', 0.8, 0.3);
        break;
    }
  }
  return out;
}

function bass(c: Ctx): NoteEvent[] {
  const out: NoteEvent[] = [];
  const { lo, hi } = REGISTER.bass;
  for (let bar = 0; bar < bars; bar++) {
    const chord = c.chords[bar]!;
    const pcs = chordPitchClasses(chord);
    const pool = notesIn(pcs, lo, hi);
    const root = nearest(notesIn([pcs[0]!], 33, 45), 38);
    const fifth = nearest(notesIn([pcs[2]!], lo, root + 9), root + 7);
    const third = nearest(notesIn([pcs[1]!], lo, root + 7), root + 4);
    const o = bar * B;
    const add = (beat: number, dur: number, midi: number, vel = 0.9) => out.push({ beat: swung(o + beat, c.swing), dur, vel, midi });
    switch (c.variant) {
      case 0: for (let i = 0; i < 8; i++) add(i * 0.5, 0.45, i % 4 === 3 ? Math.min(hi, root + 12) : root, i % 2 ? 0.6 : 0.9); break;
      case 1: add(0, 0.9, root); add(1, 0.9, third); add(2, 0.9, fifth); add(3, 0.9, nearest(pool, root + 2), 0.7); break;
      case 2: add(0, 1.4, root); add(1.5, 1.4, root, 0.8); add(3, 0.9, fifth, 0.8); add(3.5, 0.5, root + 12 > hi ? root : root + 12, 0.6); break;
      case 3: add(0, 3.6, root, 0.85); add(3.5, 0.5, fifth, 0.5); break;
      case 4: add(0, 0.9, root); add(0.75, 0.4, Math.min(hi, root + 12), 0.7); add(1.5, 0.9, root, 0.8); add(2.5, 0.4, Math.min(hi, root + 12), 0.7); add(3, 0.9, fifth, 0.8); break;
      default: for (let i = 0; i < 4; i++) add(i, 0.95, [root, fifth, Math.min(hi, root + 12), fifth][i]!, i === 0 ? 0.9 : 0.7); break;
    }
  }
  return out;
}

function melody(c: Ctx): NoteEvent[] {
  const out: NoteEvent[] = [];
  const { lo, hi } = REGISTER.melody;
  const scalePool = notesIn(c.scale, lo, hi);
  for (let bar = 0; bar < bars; bar++) {
    const chord = c.chords[bar]!;
    const tones = notesIn(chordPitchClasses(chord).filter((p) => c.scale.includes(p)), lo, hi);
    const pool = tones.length >= 3 ? tones : scalePool;
    const o = bar * B;
    const add = (beat: number, dur: number, midi: number, vel = 0.8) => out.push({ beat: swung(o + beat, c.swing), dur, vel, midi });
    switch (c.variant) {
      case 0: { // arpeggio of chord tones, up then down
        const seq = pool.slice(0, 4);
        for (let i = 0; i < 8; i++) add(i * 0.5, 0.45, seq[(i < 4 ? i : 7 - i) % seq.length]!, i % 2 ? 0.55 : 0.8);
        break;
      }
      case 1: { // hook: a composed tune (world contour x rhythm cell), resolving on a chord tone at the end
        const anchor = Math.floor(scalePool.length / 2) - 1;
        for (const [beat, dur, k] of tuneBar(c.world, 1, bar, anchor)) {
          const m = scalePool[Math.max(0, Math.min(scalePool.length - 1, k))]!;
          add(beat, dur * 0.9, bar === bars - 1 && beat >= 3 ? nearest(pool, m) : m, 0.8);
        }
        break;
      }
      case 2: { // chimes: sparse long bells
        add(0, 2, pool[0]!, 0.7); add(2, 2, pool[Math.min(2, pool.length - 1)]!, 0.55);
        if (bar % 2) add(3.5, 0.5, pool[1] ?? pool[0]!, 0.4);
        break;
      }
      case 3: { // counter melody: composed tune with the syncopated rhythm cell, a third lower than the hook
        const anchor = Math.floor(scalePool.length / 2) - 3;
        for (const [beat, dur, k] of tuneBar(c.world, 3, bar, anchor)) {
          const m = scalePool[Math.max(0, Math.min(scalePool.length - 1, k))]!;
          add(beat, dur * 0.85, bar === bars - 1 && beat >= 3 ? nearest(pool, m) : m, 0.72);
        }
        break;
      }
      case 4: { // scale run: stepwise ascending bars, falling back on the last bar
        const base = Math.floor(scalePool.length / 2) - 2 + (bar % 2) * 2;
        for (let i = 0; i < 5; i++) add(i * 0.75 + (i > 3 ? 0.25 : 0), 0.65, scalePool[Math.max(0, Math.min(scalePool.length - 1, base + (bar === bars - 1 ? 4 - i : i)))]!, 0.7);
        break;
      }
      default: { // pedal and hop: a repeated high note answered by chord-tone leaps
        const top = pool[pool.length - 1]!;
        for (const t of [0, 0.5, 1, 2, 2.5]) add(t, 0.4, top, 0.65);
        add(1.5, 0.4, pool[0]!, 0.8); add(3, 0.9, pool[Math.min(1, pool.length - 1)]!, 0.8);
      }
    }
  }
  return out;
}

function voice(c: Ctx): NoteEvent[] {
  const out: NoteEvent[] = [];
  const { lo, hi } = REGISTER.voice;
  const scalePool = notesIn(c.scale, lo, hi);
  const r = c.rand;
  let idx = Math.floor(scalePool.length / 2);
  for (let bar = 0; bar < bars; bar++) {
    const chord = c.chords[bar]!;
    const pool = notesIn(chordPitchClasses(chord), lo, hi);
    const o = bar * B;
    const add = (beat: number, dur: number, midi: number, syl: NoteEvent['syl'], vel = 0.8) => out.push({ beat: swung(o + beat, c.swing), dur, vel, midi, syl });
    switch (c.variant) {
      case 0: add(0, 1.8, pool[0]!, 'doo'); if (bar % 2) add(2.5, 1.2, pool[Math.min(1, pool.length - 1)]!, 'doo', 0.7); break; // long, lots of rests
      case 1: add(0.5, 0.3, pool[0]!, 'bah'); add(1.5, 0.3, pool[1] ?? pool[0]!, 'bah', 0.7); add(2.5, 0.3, pool[0]!, 'bah'); if (bar === bars - 1) add(3.5, 0.3, pool[2] ?? pool[0]!, 'bah', 0.9); break;
      case 2: { // melodic la-la phrase on beats 1-2, rest on 3-4
        for (let i = 0; i < 3; i++) { idx = Math.max(0, Math.min(scalePool.length - 1, idx + pick([-1, 1, 1, -2, 2], r))); add(i * 0.75, 0.6, scalePool[idx]!, 'la'); }
        break;
      }
      case 3: add(1.5, 0.35, nearest(scalePool, pool[0]! + 5), 'hey', 0.9); if (bar % 2 === 0) add(3, 0.5, nearest(scalePool, pool[0]!), 'hey', 0.7); break;
      case 4: add(0, 0.4, pool[0]!, 'doo', 0.8); add(1, 0.4, pool[1] ?? pool[0]!, 'doo', 0.7); add(2.5, 0.4, pool[0]!, 'doo', 0.8); add(3, 0.4, pool[2] ?? pool[0]!, 'doo', 0.7); break;
      default: add(2, 0.4, nearest(scalePool, pool[0]! + 4), 'hey', 0.85); add(3, 0.6, nearest(scalePool, pool[0]! + 2), 'la', 0.75); break;
    }
  }
  return out;
}

export interface PatternParams {
  stage: Pick<Stage, 'chordLoop' | 'key'>;
  layer: Layer;
  variant: number; // 0..3
  seed: number;
  swing?: number;
  world?: number;
}

export function buildPattern(p: PatternParams): NoteEvent[] {
  const chords = [...p.stage.chordLoop].sort((a, b) => a.bar - b.bar);
  const ctx: Ctx = { chords, scale: scalePitchClasses(p.stage.key), rand: rng(p.seed), variant: p.variant, swing: p.swing ?? 0, world: p.world ?? 0 };
  const events = { drums, bass, melody, voice }[p.layer](ctx);
  return events.filter((e) => e.beat >= 0 && e.beat < TUNING.beatsPerBar * bars).sort((a, b) => a.beat - b.beat);
}

/** Onset beat positions (rounded to 1/16 beat, unique) for animation. */
export const onsetsOf = (events: NoteEvent[]): number[] =>
  [...new Set(events.map((e) => Math.round(e.beat * 16) / 16))].sort((a, b) => a - b);

/** Bonus loops for combos: bright chord-tone sparkle over the chord loop, distinct per index. */
export function buildBonusPattern(stage: Pick<Stage, 'chordLoop' | 'key'>, index: number, seed: number): NoteEvent[] {
  const chords = [...stage.chordLoop].sort((a, b) => a.bar - b.bar);
  const r = rng(seed);
  const out: NoteEvent[] = [];
  const scale = scalePitchClasses(stage.key);
  const pool = notesIn(scale, 74, 86);
  for (let bar = 0; bar < bars; bar++) {
    const tones = notesIn(chordPitchClasses(chords[bar]!).filter((p) => scale.includes(p)), 74, 86);
    const o = bar * B;
    const step = [0.5, 0.25, 1 / 3][index % 3]!;
    for (let t = 0; t < B; t += step) {
      if (r() < 0.2) continue;
      out.push({ beat: o + t, dur: step * 0.9, vel: 0.5 + 0.3 * r(), midi: pick(index % 2 ? tones : pool, r) });
    }
  }
  return out.filter((e) => e.beat < B * bars);
}
