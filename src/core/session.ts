import { TUNING } from './tuning';
import { initialTracker, matchingCombos, stepTracker, type TrackerState } from './combos';
import type { AudioEngine, BarPlan } from './engine';
import { audibleIds, emptyStage, onStage, reduceStage, type StageAction, type StageState } from './stageState';
import { GoalTracker } from './goals';
import { Recorder, maxBars, type Song, type TimelineEvent } from './timeline';
import type { Stage } from './types';

export interface SessionEvents {
  onState?: (s: StageState) => void;
  onCelebration?: (comboId: string, bar: number) => void;
  onCelebrationEnd?: () => void;
  onRecordingLimit?: () => void; // auto-stopped at 3 minutes
  onBar?: (bar: number) => void;
  onGoal?: (goalKey: string) => void; // a sticker was earned
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
  /** While a complete combo is being held: when its celebration will start (in beats) and since when it counts. */
  reward: { comboId: string; startBeat: number; fromBeat: number } | null = null;
  recorder: Recorder | null = null;
  private prevState: StageState = emptyStage(); // what sounded during the previous bar
  private replay: string | null = null; // combo book replay waiting for the next loop boundary
  countIn = false; // first-run soft hi-hat count
  private discovered = new Set<string>();
  readonly goals: GoalTracker;
  constructor(readonly stage: Stage, readonly engine: AudioEngine, private events: SessionEvents = {}, discovered: Iterable<string> = [], doneGoals: Iterable<string> = []) {
    for (const d of discovered) this.discovered.add(d);
    this.goals = new GoalTracker(stage, doneGoals);
  }
  get discoveredInStage(): number { return this.stage.combos.filter((c) => this.discovered.has(c.id)).length; }

  setEvents(e: SessionEvents): void { this.events = e; }
  isDiscovered = (comboId: string): boolean => this.discovered.has(comboId);
  /** First bar at which a change made now becomes audible. */
  get nextAudibleBar(): number { return this.lastProvidedBar + 1; }

  start(): void { this.engine.start(this.stage.bpm, (bar) => this.plan(bar)); }

  dispatch(a: StageAction): void {
    this.goals.onAction(a, this.state);
    const next = reduceStage(this.state, a);
    if (next === this.state) return;
    this.state = next;
    this.recorder?.action(this.nextAudibleBar, a);
    if (a.kind === 'volume') this.engine.setVoiceGain(a.creatureId, next.volume[a.creatureId] ?? 1);
    this.events.onState?.(next);
  }

  /** Called by the engine just before each bar boundary. */
  private plan(bar: number): BarPlan {
    this.lastProvidedBar = bar;
    // Combo tracking: a celebration begins on a loop boundary after the combo was held for a full loop.
    if (this.replay && bar % 4 === 0 && !this.celebrating) {
      const combo = this.stage.combos.find((c) => c.id === this.replay)!;
      this.replay = null;
      this.tracker = { ...initialTracker(), celebrating: { comboId: combo.id, barsLeft: TUNING.celebrationBars } };
      this.celebrating = { comboId: combo.id, startBar: bar, bonusFile: combo.bonusLoopFile };
      this.recorder?.combo(bar, combo.id);
      this.events.onCelebration?.(combo.id, bar);
    } else if (bar > 0) {
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
    this.updateReward(bar);
    this.prevState = this.state;
    for (const g of this.goals.check(this.state, this.discoveredInStage)) this.events.onGoal?.(g);
    this.events.onBar?.(bar);
    const ids = audibleIds(this.state);
    return {
      ids,
      bonusFile: this.celebrating?.bonusFile ?? null,
      tick: onStage(this.state).length === 0 || this.countIn ? 'soft' : 'off',
      gains: { ...this.state.volume },
      fill: bar % TUNING.loopBars === TUNING.loopBars - 1 && this.layerCount(ids) >= 3,
    };
  }

  /** Combo book: puts the combo's 4 creatures on stage and plays its celebration at the next loop boundary. */
  replayCombo(comboId: string): void {
    const combo = this.stage.combos.find((c) => c.id === comboId);
    if (!combo || this.celebrating) return;
    this.dispatch({ kind: 'clear' });
    combo.creatureIds.forEach((id, i) => this.dispatch({ kind: 'drop', creatureId: id, spot: i + 1 }));
    this.replay = comboId;
  }

  /** Bars until the celebration of the combo that is currently held: a full loop must pass, then it starts on a loop boundary. */
  private updateReward(bar: number): void {
    const c = this.tracker.candidate;
    if (this.celebrating || !c || this.replay) { this.reward = null; return; }
    const need = Math.max(0, TUNING.loopBars * TUNING.comboWaitLoops - this.tracker.heldBars);
    const b0 = bar + need;
    const start = b0 + ((TUNING.loopBars - (b0 % TUNING.loopBars)) % TUNING.loopBars);
    if (this.reward?.comboId === c && this.reward.startBeat === start * TUNING.beatsPerBar) return;
    this.reward = { comboId: c, startBeat: start * TUNING.beatsPerBar, fromBeat: this.reward?.comboId === c ? this.reward.fromBeat : bar * TUNING.beatsPerBar };
  }

  private layerCount(ids: string[]): number {
    return new Set(ids.map((id) => this.stage.creatures.find((c) => c.id === id)?.layer)).size;
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
    const ids = bar < song.bars ? audibleIds(state) : [];
    const layers = new Set(ids.map((id) => stage.creatures.find((c) => c.id === id)?.layer)).size;
    return { ids, bonusFile: bar < song.bars ? bonus?.file ?? null : null, tick: 'off', gains: { ...state.volume }, fill: bar % 4 === 3 && layers >= 3 };
  };
}
