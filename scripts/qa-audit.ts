// Full offline mix audit: every 6-creature combination of each stage (8,008 per stage). Run: npm run qa:audit
import { TUNING } from '../src/core/tuning';
import { auditStageMixes, decodeLoop, loadStages, loopLufs } from './qa-lib';

let failed = false;
const only = process.argv[2];
for (const stage of loadStages()) {
  if (only && stage.id !== only) continue;
  const bank: Record<string, Float32Array> = {};
  for (const c of stage.creatures) bank[c.loopFile] = decodeLoop(c.loopFile);
  for (const c of stage.creatures) {
    const l = loopLufs(bank[c.loopFile]!);
    if (Math.abs(l - TUNING.targetLufs) > TUNING.lufsTolerance) { console.log(`FAIL loudness ${c.id} ${l.toFixed(2)}`); failed = true; }
  }
  const t0 = Date.now();
  const r = auditStageMixes(stage, bank, 6, 8008);
  const ok = r.worstPeakDb <= TUNING.masterLimiterDb + 0.05 && r.worstReductionDb <= TUNING.maxGainReductionDb;
  console.log(`${stage.id}: ${r.combos} combos, peak ${r.worstPeakDb.toFixed(2)} dB, max reduction ${r.worstReductionDb.toFixed(2)} dB ${ok ? 'OK' : 'FAIL'} (${((Date.now() - t0) / 1000).toFixed(0)} s) worst=${r.worst.join(',')}`);
  if (!ok) failed = true;
}
process.exit(failed ? 1 : 0);
