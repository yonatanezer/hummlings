import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/core/tuning';
import { auditStageMixes, decodeLoop, loadStages, loopLufs } from '../scripts/qa-lib';

// Fast version of the full audit (every 40th 6-creature combination); the full 8,008 run in `npm run qa:audit`.
describe('mix audit (sampled)', () => {
  for (const stage of loadStages()) {
    it(`${stage.id}: loops at -20 LUFS, mixes stay under the limiter ceiling`, () => {
      const bank: Record<string, Float32Array> = {};
      for (const c of stage.creatures) bank[c.loopFile] = decodeLoop(c.loopFile);
      for (const c of stage.creatures) expect(Math.abs(loopLufs(bank[c.loopFile]!) - TUNING.targetLufs), c.id).toBeLessThanOrEqual(TUNING.lufsTolerance);
      const r = auditStageMixes(stage, bank, 6, 40);
      expect(r.combos).toBeGreaterThan(150);
      expect(r.worstPeakDb).toBeLessThanOrEqual(TUNING.masterLimiterDb + 0.05);
      expect(r.worstReductionDb).toBeLessThanOrEqual(TUNING.maxGainReductionDb);
    });
  }
});
