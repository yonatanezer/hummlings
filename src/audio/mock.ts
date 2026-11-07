import type { AudioEngine, BarPlan, BarProvider, EngineState } from '../core/engine';
import { TUNING } from '../core/tuning';
import type { Stage } from '../core/types';

/** Virtual-clock engine: tests call `advanceBars`; the web check build can call `startRealtime`. */
export class MockEngine implements AudioEngine {
  state: EngineState = 'idle';
  beats = 0;
  bar = -1; // last bar asked from the provider
  volume = 1;
  plans: BarPlan[] = [];
  loaded: string | null = null;
  private provider: BarProvider | null = null;
  private bpm = 100;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  async init(): Promise<void> {}
  async loadStage(stage: Stage): Promise<void> { this.loaded = stage.id; }
  async decodeBank(files: string[], loopSamples: number): Promise<Record<string, Float32Array>> {
    return Object.fromEntries(files.map((f) => [f, new Float32Array(loopSamples)]));
  }
  start(bpm: number, provider: BarProvider): void {
    this.bpm = bpm; this.provider = provider; this.state = 'running'; this.beats = 0; this.bar = -1; this.plans = [];
    this.ask(0);
  }
  private ask(bar: number): void {
    this.bar = bar;
    this.plans[bar] = this.provider!(bar);
  }
  /** Moves virtual time forward; asks for every bar boundary passed (bars are requested one bar early, like the real engine). */
  advanceBars(n: number): void {
    for (let i = 0; i < n; i++) {
      if (this.state !== 'running') return;
      this.beats += TUNING.beatsPerBar;
      this.ask(this.bar + 1);
    }
  }
  /** Real-time driver for the web check build. */
  startRealtime(): void {
    const barMs = (60000 / this.bpm) * TUNING.beatsPerBar;
    this.timer = setInterval(() => this.advanceBars(1), barMs);
  }
  pause(): void { if (this.state === 'running') this.state = 'paused'; }
  resume(): void { if (this.state === 'paused') this.state = 'running'; }
  stop(): void { this.state = 'idle'; if (this.timer) clearInterval(this.timer); }
  positionBeats(): number { return this.beats; }
  sfx: { kind: string; rate: number }[] = [];
  playSfx(kind: string, rate = 1): void { this.sfx.push({ kind, rate }); }
  setVolume(v: number): void { this.volume = v; }
  onInterrupted(cb: () => void): () => void { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  interrupt(): void { this.pause(); this.listeners.forEach((l) => l()); }
}
