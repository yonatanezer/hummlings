import { TUNING } from './tuning';
import { reduceStage, emptyStage, type StageAction, type StageState } from './stageState';

export type TimelineEvent =
  | { bar: number; action: StageAction }
  | { bar: number; combo: string }; // celebration start

export interface Song {
  id: string;
  name: string;
  stageId: string;
  createdAt: number; // epoch ms
  bars: number; // length in bars
  events: TimelineEvent[];
}

export const maxBars = (bpm: number): number => Math.floor((TUNING.maxRecordingSec * bpm) / 60 / TUNING.beatsPerBar);
export const warnBars = (bpm: number): number =>
  Math.max(0, maxBars(bpm) - Math.ceil((TUNING.recordingWarnSec * bpm) / 60 / TUNING.beatsPerBar));

export const clampName = (name: string): string => Array.from(name.trim()).slice(0, TUNING.songNameMax).join('');
export const autoName = (existing: readonly string[]): string => {
  let n = existing.length + 1;
  while (existing.includes(`Song ${n}`)) n += 1;
  return `Song ${n}`;
};

/** Collects actions, quantised to the bar in which they become audible. */
export class Recorder {
  events: TimelineEvent[] = [];
  constructor(readonly startBar: number, readonly maxBarCount: number, initial: StageState) {
    // The state at record start is replayed as drops at bar 0 so a song is self-contained.
    initial.spots.forEach((id, spot) => {
      if (id) this.events.push({ bar: 0, action: { kind: 'drop', creatureId: id, spot } });
    });
    Object.keys(initial.muted).forEach((id) => this.events.push({ bar: 0, action: { kind: 'mute', creatureId: id } }));
    if (initial.solo) this.events.push({ bar: 0, action: { kind: 'solo', creatureId: initial.solo } });
  }
  /** `audibleBar` = global bar index at which the change takes effect. */
  action(audibleBar: number, action: StageAction): void {
    if (action.kind === 'volume') { // dragging a slider produces many events: keep only the last per creature and bar
      const bar = Math.max(0, audibleBar - this.startBar);
      const i = this.events.findIndex((e) => 'action' in e && e.bar === bar && e.action.kind === 'volume' && e.action.creatureId === action.creatureId);
      if (i >= 0) { this.events[i] = { bar, action }; return; }
    }
    this.events.push({ bar: Math.max(0, audibleBar - this.startBar), action });
  }
  combo(audibleBar: number, comboId: string): void {
    this.events.push({ bar: Math.max(0, audibleBar - this.startBar), combo: comboId });
  }
  /** Finish at `endBar` (exclusive, global). Saved up to the last full bar. */
  finish(endBar: number, meta: { id: string; name: string; stageId: string; createdAt: number }): Song | null {
    const bars = Math.min(this.maxBarCount, endBar - this.startBar);
    if (bars < 1) return null;
    return { ...meta, bars, events: this.events.filter((e) => e.bar < bars) };
  }
}

/** Stage state at the start of `bar` after applying all events with e.bar <= bar. */
export function stateAtBar(song: Song, bar: number): StageState {
  let s = emptyStage();
  for (const e of song.events) if ('action' in e && e.bar <= bar) s = reduceStage(s, e.action);
  return s;
}

export const comboStartsAt = (song: Song, bar: number): string | null => {
  const e = song.events.find((x) => 'combo' in x && x.bar === bar);
  return e && 'combo' in e ? e.combo : null;
};
