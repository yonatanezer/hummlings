import { describe, expect, it } from 'vitest';
import { blinkOpen } from '../src/core/anim';
import { TUNING } from '../src/core/tuning';

describe('blinkOpen', () => {
  it('blinks every 3-6 s, each blink 140 ms, at any elapsed time', () => {
    for (const seed of [1, 7, 123456, 99999999]) {
      for (const start of [0, 600_000, 36_000_000]) {
        const starts: number[] = [];
        let was = 1;
        for (let t = start; t < start + 120_000; t += 5) {
          const o = blinkOpen(t, seed);
          expect(o).toBeGreaterThanOrEqual(0);
          expect(o).toBeLessThanOrEqual(1);
          if (was === 1 && o < 1) starts.push(t);
          was = o;
        }
        expect(starts.length).toBeGreaterThan(15);
        for (let i = 1; i < starts.length; i++) {
          const gap = starts[i]! - starts[i - 1]!;
          expect(gap).toBeGreaterThanOrEqual(TUNING.blinkMinMs - 160);
          expect(gap).toBeLessThanOrEqual(TUNING.blinkMaxMs + 10);
        }
      }
    }
  });
  it('costs the same after hours as at the start', () => {
    const t0 = performance.now(); for (let i = 0; i < 20000; i++) blinkOpen(i, 5); const early = performance.now() - t0;
    const t1 = performance.now(); for (let i = 0; i < 20000; i++) blinkOpen(40_000_000 + i, 5); const late = performance.now() - t1;
    expect(late).toBeLessThan(early * 5 + 5);
  });
});
