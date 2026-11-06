// Shared QA helpers (used by tests and by scripts/qa-audit.ts).
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { limit, lufs } from '../src/core/mix';
import { rng } from '../src/core/patterns';
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

/**
 * Sums k-combinations of the stage's loops, applies the master trim + limiter, reports the worst cases.
 * With 24 creatures per world C(24,6) = 134,596 combinations, so the audit covers (a) every combination of the 9 loudest-peak
 * loops (the worst cases by construction) and (b) `random` seeded random combinations.
 */
export function auditStageMixes(stage: Stage, bank: Record<string, Float32Array>, k = 6, random = 8008, seed = 7): MixAudit {
  const peaks = stage.creatures.map((c) => ({ id: c.id, peak: bank[c.loopFile]!.reduce((m, x) => Math.max(m, Math.abs(x)), 0) }));
  const loudest = [...peaks].sort((a, b) => b.peak - a.peak).slice(0, 9).map((p) => p.id);
  const ids = stage.creatures.map((c) => c.id);
  const sets: string[][] = [...combinations(loudest, k)];
  const r = rng(seed);
  for (let i = 0; i < random; i++) {
    const pool = [...ids];
    const pick: string[] = [];
    for (let j = 0; j < k; j++) pick.push(pool.splice(Math.floor(r() * pool.length), 1)[0]!);
    sets.push(pick);
  }
  const buf = new Float32Array(bank[stage.creatures[0]!.loopFile]!.length);
  let worstPeakDb = -Infinity, worstReductionDb = 0, worst: string[] = [];
  for (const combo of sets) {
    buf.fill(0);
    for (const id of combo) {
      const l = bank[stage.creatures.find((c) => c.id === id)!.loopFile]!;
      for (let s = 0; s < buf.length; s++) buf[s]! += l[s]!;
    }
    for (let s = 0; s < buf.length; s++) buf[s]! *= masterTrim();
    const st = limit(buf);
    if (st.peakDb > worstPeakDb) worstPeakDb = st.peakDb;
    if (st.maxGainReductionDb > worstReductionDb) { worstReductionDb = st.maxGainReductionDb; worst = combo; }
  }
  return { combos: sets.length, worstPeakDb, worstReductionDb, worst };
}

export const loopLufs = (buf: Float32Array): number => lufs(buf);
