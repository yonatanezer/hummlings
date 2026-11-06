import { describe, expect, it } from 'vitest';
import { makeGate } from '../src/core/gate';
import { rng } from '../src/core/patterns';

describe('parental gate', () => {
  it('always has the correct answer once among 3 distinct options', () => {
    const r = rng(5);
    for (let i = 0; i < 200; i++) {
      const g = makeGate(r);
      expect(g.options).toHaveLength(3);
      expect(new Set(g.options).size).toBe(3);
      expect(g.options.filter((o) => o === g.correct)).toHaveLength(1);
      expect(g.a + g.b).toBe(g.correct);
      expect(g.a).toBeGreaterThanOrEqual(2);
      expect(g.b).toBeLessThanOrEqual(9);
    }
  });
});
