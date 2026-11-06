import { initialTracker, matchingCombos, stepTracker, type TrackerState } from './combos';
import type { AudioEngine, BarPlan } from './engine';
import { audibleIds, emptyStage, onStage, reduceStage, type StageAction, type StageState } from './stageState';
import { Recorder, maxBars, type Song, type TimelineEvent } from './timeline';
import type { Stage } from './types';

export interface SessionEvents {
  onState?: (s: StageState) => void;
  onCelebration?: (comboId: string, bar: number) => void;
  onCelebrationEnd?: () => void;
  onRecordingLimit?: () => void; // auto-stopped at 3 minutes
  onBar?: (bar: number) => void;
}

/**
 * Live session of one stage: owns the immediate state, applies it to the engine at bar boundaries,
 * detects combos and records the timeline. No UI imports; the engine is injected.
 */
export class Session {
  state: StageState = emptyStage();
  tracker: TrackerState = initialTracker();
  lastProvidedBar = -1;
  celebrating: { comboId: string; startBar: number; bonusFile: string } | null = null;
  recorder: Recorder | null = null;
  private prevState: StageState = emptyStage(); // what sounded during the previous bar
  countIn = false; // first-run soft hi-hat count
  private discovered = new Set<string>();
  constructor(readonly stage: Stage, readonly engine: AudioEngine, private events: SessionEvents = {}, discovered: Iterable<string> = []) {
    for (const d of discovered) this.discovered.add(d);
  }

  setEvents(e: SessionEvents): void { this.events = e; }
  isDiscovered = (comboId: string): boolean => this.discovered.has(comboId);
  /** First bar at which a change made now becomes audible. */
  get nextAudibleBar(): number { return this.lastProvidedBar + 1; }

  start(): void { this.engine.start(this.stage.bpm, (bar) => this.plan(bar)); }

  dispatch(a: StageAction): void {
    const next = reduceStage(this.state, a);
    if (next === this.state) return;
    this.state = next;
    this.recorder?.action(this.nextAudibleBar, a);
    this.events.onState?.(next);
  }

  /** Called by the engine just before each bar boundary. */
  private plan(bar: number): BarPlan {
    this.lastProvidedBar = bar;
    // Combo tracking: a celebration begins on a loop boundary after the combo was held for a full loop.
    if (bar > 0) {
      const matching = this.celebrating ? [] : matchingCombos(this.stage.combos, this.prevState);
      const res = stepTracker(this.tracker, bar - 1, matching);
      this.tracker = res.state;
      if (res.started) {
        const combo = this.stage.combos.find((c) => c.id === res.started)!;
        this.celebrating = { comboId: combo.id, startBar: bar, bonusFile: combo.bonusLoopFile };
        this.discovered.add(combo.id);
        this.recorder?.combo(bar, combo.id);
        this.events.onCelebration?.(combo.id, bar);
      } else if (res.ended) {
        this.celebrating = null;
        this.events.onCelebrationEnd?.();
      }
    }
    if (this.recorder && bar - this.recorder.startBar >= this.recorder.maxBarCount) {
      this.events.onRecordingLimit?.();
    }
    this.prevState = this.state;
    this.events.onBar?.(bar);
    const ids = audibleIds(this.state);
    return {
      ids,
      bonusFile: this.celebrating?.bonusFile ?? null,
      tick: onStage(this.state).length === 0 || this.countIn ? 'soft' : 'off',
    };
  }

  startRecording(): void {
    this.recorder = new Recorder(this.nextAudibleBar, maxBars(this.stage.bpm), this.state);
  }
  /** Stops recording; returns the song (saved up to the last full bar) or null if nothing was recorded. */
  stopRecording(meta: { id: string; name: string; createdAt: number }): Song | null {
    const r = this.recorder;
    this.recorder = null;
    return r ? r.finish(this.nextAudibleBar, { ...meta, stageId: this.stage.id }) : null;
  }
}

/** Provider for replaying a recorded song through the engine (Player screen). */
export function songProvider(stage: Stage, song: Song): (bar: number) => BarPlan {
  let state = emptyStage();
  let bonus: { file: string; start: number } | null = null;
  return (bar) => {
    for (const e of song.events as TimelineEvent[]) {
      if (e.bar !== bar) continue;
      if ('action' in e) state = reduceStage(state, e.action);
      else {
        const c = stage.combos.find((x) => x.id === e.combo);
        if (c) bonus = { file: c.bonusLoopFile, start: bar };
      }
    }
    if (bonus && bar - bonus.start >= 8) bonus = null;
    return { ids: bar < song.bars ? audibleIds(state) : [], bonusFile: bar < song.bars ? bonus?.file ?? null : null, tick: 'off' };
  };
}
