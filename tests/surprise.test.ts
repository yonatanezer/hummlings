import { describe, expect, it } from 'vitest';
import { randomBand } from '../src/core/surprise';
import { rng } from '../src/core/patterns';
import { LAYERS } from '../src/core/types';
import { loadStages } from '../scripts/qa-lib';

describe('surprise band', () => {
  it('always six different singers with every layer present', () => {
    const r = rng(11);
    for (const st of loadStages()) for (let i = 0; i < 50; i++) {
      const ids = randomBand(st, r);
      expect(ids).toHaveLength(6);
      expect(new Set(ids).size).toBe(6);
      const layers = new Set(ids.map((id) => st.creatures.find((c) => c.id === id)!.layer));
      for (const l of LAYERS) expect(layers.has(l)).toBe(true);
    }
  });
});
