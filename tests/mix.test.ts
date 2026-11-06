import { describe, expect, it } from 'vitest';
import { limit, lufs } from '../src/core/mix';
import { renderSong, samplesPerBar } from '../src/core/render';
import { TUNING, masterTrim } from '../src/core/tuning';
import type { Stage } from '../src/core/types';

const sine = (n: number, amp: number, f = 220): Float32Array =>
  Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / TUNING.sampleRate));

describe('limiter', () => {
  it('keeps peaks below -1 dBFS and reports gain reduction', () => {
    const b = sine(48000, 1.6);
    const st = limit(b);
    expect(st.peakDb).toBeLessThanOrEqual(-0.99);
    expect(st.maxGainReductionDb).toBeGreaterThan(3);
  });
  it('leaves quiet audio untouched', () => {
    const b = sine(48000, 0.3);
    const copy = b.slice();
    expect(limit(b).maxGainReductionDb).toBe(0);
    expect(b).toEqual(copy);
  });
  it('lufs of a quiet sine is lower than a loud one', () => {
    expect(lufs(sine(96000, 0.1))).toBeLessThan(lufs(sine(96000, 0.4)));
  });
});

describe('offline render', () => {
  const bpm = 96;
  const spb = samplesPerBar(bpm);
  const stage = {
    bpm, loopBars: 4,
    creatures: [{ id: 'a', loopFile: 'a' }, { id: 'b', loopFile: 'b' }],
    combos: [],
  } as unknown as Stage;
  const bank = { a: sine(spb * 4, 0.2, 200), b: sine(spb * 4, 0.2, 400) };
  it('starts a layer at its bar, fades in, stays in phase', () => {
    const song = { id: 's', name: 'n', stageId: 'x', createdAt: 0, bars: 3, events: [
      { bar: 1, action: { kind: 'drop' as const, creatureId: 'a', spot: 0 } },
    ] };
    const { samples } = renderSong(stage, song, bank);
    expect(samples).toHaveLength(spb * 3);
    expect(Math.max(...samples.slice(0, spb).map(Math.abs))).toBe(0);
    expect(Math.abs(samples[spb]!)).toBeLessThan(0.01); // fading in
    const mid = spb + 5000;
    expect(samples[mid]).toBeCloseTo(bank.a[mid]! * masterTrim(), 5); // phase = global bar mod 4
  });
  it('is deterministic: same song, same samples', () => {
    const song = { id: 's', name: 'n', stageId: 'x', createdAt: 0, bars: 4, events: [
      { bar: 0, action: { kind: 'drop' as const, creatureId: 'a', spot: 0 } },
      { bar: 2, action: { kind: 'drop' as const, creatureId: 'b', spot: 1 } },
    ] };
    expect(renderSong(stage, song, bank).samples).toEqual(renderSong(stage, song, bank).samples);
  });
});
