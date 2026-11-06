import { TUNING, barSec, masterTrim } from './tuning';
import { audibleIds, emptyStage, reduceStage, type StageState } from './stageState';
import type { Song } from './timeline';
import type { Stage } from './types';
import { limit } from './mix';

/** Decoded loop audio keyed by loopFile / bonusLoopFile. All buffers: mono, TUNING.sampleRate, exactly one loop long. */
export type LoopBank = Record<string, Float32Array>;

export const samplesPerBar = (bpm: number, sr = TUNING.sampleRate): number => Math.round(barSec(bpm) * sr);

/** Per-bar layer gain ramp: fade in 20 ms / fade out 40 ms at bar boundaries. */
function rampGain(prev: boolean, next: boolean, i: number, sr: number): number {
  if (prev === next) return next ? 1 : 0;
  const len = Math.round(((next ? TUNING.fadeInMs : TUNING.fadeOutMs) / 1000) * sr);
  const t = Math.min(1, i / len);
  return next ? t : 1 - t;
}

export interface RenderResult {
  samples: Float32Array;
  maxGainReductionDb: number;
  peakDb: number;
}

/**
 * Renders a song (or a static set of ids) offline: sum of looped buffers on one clock + master limiter.
 * Loops stay in phase with the global bar counter (bar mod loopBars), exactly like the live engine.
 */
export function renderSong(stage: Stage, song: Song, bank: LoopBank): RenderResult {
  const spb = samplesPerBar(stage.bpm);
  const total = spb * song.bars;
  const out = new Float32Array(total);
  const byId = new Map(stage.creatures.map((c) => [c.id, c]));
  let state: StageState = emptyStage();
  let prevAudible = new Set<string>();
  let bonus: { file: string; startBar: number } | null = null;
  for (let bar = 0; bar < song.bars; bar++) {
    for (const e of song.events) {
      if (e.bar !== bar) continue;
      if ('action' in e) state = reduceStage(state, e.action);
      else {
        const combo = stage.combos.find((c) => c.id === e.combo);
        if (combo) bonus = { file: combo.bonusLoopFile, startBar: bar };
      }
    }
    if (bonus && bar - bonus.startBar >= TUNING.celebrationBars) bonus = null;
    const audible = new Set(audibleIds(state));
    const loopPos = (bar % stage.loopBars) * spb;
    const layers: { buf: Float32Array; wasOn: boolean; isOn: boolean }[] = [];
    for (const id of new Set([...prevAudible, ...audible])) {
      const c = byId.get(id);
      const buf = c && bank[c.loopFile];
      if (buf) layers.push({ buf, wasOn: prevAudible.has(id), isOn: audible.has(id) });
    }
    if (bonus && bank[bonus.file]) layers.push({ buf: bank[bonus.file]!, wasOn: bar > bonus.startBar, isOn: true });
    const base = bar * spb;
    for (const l of layers) {
      const len = l.buf.length;
      for (let i = 0; i < spb; i++) {
        const g = rampGain(l.wasOn, l.isOn, i, TUNING.sampleRate);
        if (g === 0) continue;
        out[base + i] = out[base + i]! + l.buf[(loopPos + i) % len]! * g;
      }
    }
    prevAudible = audible;
  }
  const trim = masterTrim();
  for (let i = 0; i < out.length; i++) out[i] = out[i]! * trim;
  const stats = limit(out);
  return { samples: out, maxGainReductionDb: stats.maxGainReductionDb, peakDb: stats.peakDb };
}
