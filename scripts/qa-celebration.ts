// Mix audit for celebrations: six singers + the combo's bonus loop + the world's ambience bed. Run: npx tsx scripts/qa-celebration.ts
import { limit } from '../src/core/mix';
import { rng } from '../src/core/patterns';
import { masterTrim, TUNING } from '../src/core/tuning';
import { decodeLoop, loadStages } from './qa-lib';

const r = rng(21);
let failed = false;
for (const st of loadStages()) {
  const bank: Record<string, Float32Array> = {};
  for (const f of [...st.creatures.map((c) => c.loopFile), ...st.combos.map((c) => c.bonusLoopFile), st.ambienceFile]) bank[f] = decodeLoop(f);
  const amb = bank[st.ambienceFile]!;
  const buf = new Float32Array(amb.length);
  let worst = 0, worstPeak = -Infinity;
  for (let n = 0; n < 400; n++) {
    const pool = [...st.creatures];
    const picks = Array.from({ length: 6 }, () => pool.splice(Math.floor(r() * pool.length), 1)[0]!);
    const bonus = bank[st.combos[n % st.combos.length]!.bonusLoopFile]!;
    buf.fill(0);
    for (const c of picks) { const l = bank[c.loopFile]!; for (let i = 0; i < buf.length; i++) buf[i]! += l[i]!; }
    for (let i = 0; i < buf.length; i++) buf[i] = (buf[i]! + bonus[i]! + amb[i]!) * masterTrim();
    const s = limit(buf);
    worst = Math.max(worst, s.maxGainReductionDb); worstPeak = Math.max(worstPeak, s.peakDb);
  }
  const ok = worst <= TUNING.maxGainReductionDb + 0.5;
  console.log(`${st.id}: celebration mixes (400 samples): max reduction ${worst.toFixed(2)} dB, peak ${worstPeak.toFixed(2)} dB ${ok ? 'OK' : 'FAIL'}`);
  if (!ok) failed = true;
}
process.exit(failed ? 1 : 0);
