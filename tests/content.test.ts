import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { validateStage } from '../src/core/schema';
import { buildPattern, onsetsOf, buildBonusPattern } from '../src/core/patterns';
import { chordPitchClasses, REGISTER, scalePitchClasses } from '../src/core/music';
import { en } from '../src/i18n/en';
import { buildStage, seedOf } from '../scripts/build-content';
import { STAGES as DEFS } from '../scripts/stage-defs';
import type { Stage } from '../src/core/types';

const files = readdirSync('content/stages').filter((f) => f.endsWith('.json')).sort();
const stages: Stage[] = files.map((f) => {
  const { stage, errors } = validateStage(JSON.parse(readFileSync(`content/stages/${f}`, 'utf8')));
  expect(errors, f).toEqual([]);
  return stage!;
});

describe('content audit (every stage, every creature, every combo)', () => {
  it('has exactly 3 stages x 16 creatures x 3 combos with globally unique stable ids', () => {
    expect(stages).toHaveLength(3);
    const ids = stages.flatMap((s) => [...s.creatures.map((c) => c.id), ...s.combos.map((c) => c.id), ...s.combos.map((c) => c.celebrationId)]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3 * (16 + 3 + 3));
  });
  it('distinct tempo, key and palette per stage; tempos 84-112', () => {
    expect(new Set(stages.map((s) => s.bpm)).size).toBe(3);
    expect(new Set(stages.map((s) => `${s.key.root}${s.key.mode}`)).size).toBe(3);
    expect(new Set(stages.map((s) => s.palette.sky)).size).toBe(3);
  });
  it('every name key exists in the dictionary', () => {
    for (const s of stages) expect(Object.keys(en)).toContain(s.nameKey);
  });
  it('every loop file exists and the committed JSON is not stale', () => {
    stages.forEach((s, i) => {
      for (const c of s.creatures) expect(existsSync(`assets/loops/${c.loopFile}`), c.loopFile).toBe(true);
      for (const c of s.combos) expect(existsSync(`assets/loops/${c.bonusLoopFile}`), c.bonusLoopFile).toBe(true);
      expect(s).toEqual(buildStage(i));
    });
  });
  it('combos use four different layers and are all different sets', () => {
    for (const s of stages) {
      const sets = s.combos.map((c) => [...c.creatureIds].sort().join('|'));
      expect(new Set(sets).size).toBe(3);
      for (const c of s.combos) {
        const layers = c.creatureIds.map((id) => s.creatures.find((x) => x.id === id)!.layer);
        expect(new Set(layers).size).toBe(4);
      }
    }
  });
  it('pitched notes are in the stage scale or chord tones, inside their register, on the grid', () => {
    stages.forEach((s, si) => {
      const scale = scalePitchClasses(s.key);
      s.creatures.forEach((c, i) => {
        const events = buildPattern({ stage: s, layer: c.layer, variant: i % 4, seed: seedOf(si, ['drums', 'bass', 'melody', 'voice'].indexOf(c.layer), i % 4), swing: DEFS[si]!.swing });
        expect(events.length, c.id).toBeGreaterThan(0);
        expect(onsetsOf(events)).toEqual(c.onsets);
        if (c.layer === 'drums') return;
        const reg = REGISTER[c.layer];
        for (const e of events) {
          const bar = Math.floor(e.beat / 4);
          const pc = e.midi! % 12;
          const ok = scale.includes(pc) || chordPitchClasses(s.chordLoop[bar]!).includes(pc);
          expect(ok, `${c.id} beat ${e.beat} midi ${e.midi}`).toBe(true);
          expect(e.midi!, c.id).toBeGreaterThanOrEqual(reg.lo);
          expect(e.midi!, c.id).toBeLessThanOrEqual(reg.hi);
        }
        if (c.layer === 'voice') {
          const sung = events.reduce((a, e) => a + e.dur, 0);
          expect(sung, `${c.id} needs rhythmic gaps`).toBeLessThanOrEqual(0.7 * 16);
        }
      });
      s.combos.forEach((c, i) => {
        const ev = buildBonusPattern(s, i, 9000 + si * 10 + i);
        expect(ev.length).toBeGreaterThan(8);
        for (const e of ev) expect(scale.includes(e.midi! % 12) || chordPitchClasses(s.chordLoop[Math.floor(e.beat / 4)]!).includes(e.midi! % 12)).toBe(true);
      });
    });
  });
  it('melody stays above 500 Hz and bass fundamental below 250 Hz', () => {
    const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
    expect(hz(REGISTER.melody.lo)).toBeGreaterThan(500);
    expect(hz(REGISTER.bass.hi)).toBeLessThan(250);
    expect(hz(REGISTER.voice.lo)).toBeGreaterThanOrEqual(250);
    expect(hz(REGISTER.voice.hi)).toBeLessThanOrEqual(500);
  });
});
