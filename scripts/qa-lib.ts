// Shared QA helpers (used by tests and by scripts/qa-audit.ts).
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { limit, lufs } from '../src/core/mix';
import { masterTrim } from '../src/core/tuning';
import { validateStage } from '../src/core/schema';
import type { Stage } from '../src/core/types';

export function loadStages(): Stage[] {
  return readdirSync('content/stages').filter((f) => f.endsWith('.json')).sort()
    .map((f) => validateStage(JSON.parse(readFileSync(`content/stages/${f}`, 'utf8'))).stage!);
}

/** Decodes an m4a loop to mono Float32 (what the app will play), via ffmpeg. */
export function decodeLoop(file: string, dir = 'assets/loops'): Float32Array {
  const out = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', `${dir}/${file}`, '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength));
}

export function* combinations<T>(items: readonly T[], k: number): Generator<T[]> {
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => items[i]!);
    let i = k - 1;
    while (i >= 0 && idx[i] === items.length - k + i) i--;
    if (i < 0) return;
    idx[i]!++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
}

export interface MixAudit { combos: number; worstPeakDb: number; worstReductionDb: number; worst: string[] }

/** Sums every k-combination of the stage's loops (or every `step`-th), applies the master limiter, reports worst cases. */
export function auditStageMixes(stage: Stage, bank: Record<string, Float32Array>, k = 6, step = 1): MixAudit {
  const ids = stage.creatures.map((c) => c.id);
  const buf = new Float32Array(bank[stage.creatures[0]!.loopFile]!.length);
  let n = 0, worstPeakDb = -Infinity, worstReductionDb = 0, worst: string[] = [];
  let i = 0;
  for (const combo of combinations(ids, k)) {
    if (i++ % step) continue;
    buf.fill(0);
    for (const id of combo) {
      const l = bank[stage.creatures.find((c) => c.id === id)!.loopFile]!;
      for (let s = 0; s < buf.length; s++) buf[s]! += l[s]!;
    }
    for (let s = 0; s < buf.length; s++) buf[s]! *= masterTrim();
    const st = limit(buf);
    n++;
    if (st.peakDb > worstPeakDb) worstPeakDb = st.peakDb;
    if (st.maxGainReductionDb > worstReductionDb) { worstReductionDb = st.maxGainReductionDb; worst = combo; }
  }
  return { combos: n, worstPeakDb, worstReductionDb, worst };
}

export const loopLufs = (buf: Float32Array): number => lufs(buf);
