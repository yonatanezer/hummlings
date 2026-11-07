import type { AudioEngine, BarPlan, BarProvider, EngineState, SfxKind } from '../src/core/engine';
import { softClipCurve } from '../src/core/mix';
import { TUNING, barSec, beatSec, masterTrim } from '../src/core/tuning';
import type { Stage } from '../src/core/types';

const LOOKAHEAD_S = 0.15;
const START_DELAY_S = 0.12;
const BONUS = '__bonus';
const AMBIENCE = '__ambience';

/** Browser (Web Audio) twin of src/audio/native.ts: same scheduling, used by the playable web demo. */
export class WebEngine implements AudioEngine {
  state: EngineState = 'idle';
  ctx!: AudioContext;
  private master!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  private tick: AudioBuffer | null = null;
  private sfxBuf = new Map<string, AudioBuffer>();
  private ambFile = '';
  private fileOf = new Map<string, string>();
  private origin = 0;
  private nextBar = 0;
  private bpm = 100;
  private provider: BarProvider | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private volume = 0.8;
  base = '';

  async init(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new AudioContext({ sampleRate: TUNING.sampleRate });
    this.master = this.ctx.createGain();
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = softClipCurve() as Float32Array<ArrayBuffer>;
    this.master.connect(shaper);
    shaper.connect(this.ctx.destination);
    this.setVolume(this.volume);
    this.tick = await this.load('audio/tick.mp3');
    for (const k of ['pop', 'pickup', 'mute', 'unmute', 'remove', 'goal', 'combo', 'snare']) this.sfxBuf.set(k, await this.load(`audio/sfx_${k}.mp3`));
  }
  private async load(url: string): Promise<AudioBuffer> {
    const res = await fetch(this.base + url);
    return this.ctx.decodeAudioData(await res.arrayBuffer());
  }
  async loadStage(stage: Stage): Promise<void> {
    this.fileOf = new Map(stage.creatures.map((c) => [c.id, c.loopFile]));
    this.ambFile = stage.ambienceFile;
    const files = [...stage.creatures.map((c) => c.loopFile), ...stage.combos.map((c) => c.bonusLoopFile), stage.ambienceFile];
    await Promise.all(files.filter((f) => !this.buffers.has(f)).map(async (f) => this.buffers.set(f, await this.load(`audio/${f.replace('.m4a', '.mp3')}`))));
    for (const k of [...this.buffers.keys()]) if (!files.includes(k)) this.buffers.delete(k);
  }
  async decodeBank(): Promise<Record<string, Float32Array>> { return {}; }
  start(bpm: number, provider: BarProvider): void {
    this.stop();
    this.bpm = bpm; this.provider = provider; this.nextBar = 0;
    this.origin = this.ctx.currentTime + START_DELAY_S;
    this.state = 'running';
    void this.ctx.resume();
    this.timer = setInterval(() => this.pump(), 25);
    this.pump();
  }
  private pump(): void {
    if (this.state !== 'running' || !this.provider) return;
    const bs = barSec(this.bpm);
    while (this.origin + this.nextBar * bs < this.ctx.currentTime + LOOKAHEAD_S) {
      const bar = this.nextBar++;
      this.apply(bar, this.origin + bar * bs, this.provider(bar));
    }
  }
  private apply(bar: number, t: number, plan: BarPlan): void {
    const ctx = this.ctx, bs = barSec(this.bpm);
    const wanted = new Set(plan.ids);
    if (plan.bonusFile) wanted.add(BONUS);
    wanted.add(AMBIENCE); // the world's bed always plays
    for (const [id, v] of this.voices) {
      if (wanted.has(id)) continue;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(1, t);
      v.gain.gain.linearRampToValueAtTime(0, t + TUNING.fadeOutMs / 1000);
      v.src.stop(t + TUNING.fadeOutMs / 1000 + 0.02);
      this.voices.delete(id);
    }
    const launch = (key: string, file: string) => {
      if (this.voices.has(key)) return;
      const buf = this.buffers.get(file);
      if (!buf) return;
      const src = ctx.createBufferSource(), gain = ctx.createGain();
      src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = bs * TUNING.loopBars;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + TUNING.fadeInMs / 1000);
      src.connect(gain); gain.connect(this.master);
      src.start(t, (bar % TUNING.loopBars) * bs); // in phase with the global clock
      this.voices.set(key, { src, gain });
    };
    for (const id of plan.ids) launch(id, this.fileOf.get(id) ?? '');
    if (plan.bonusFile) launch(BONUS, plan.bonusFile);
    launch(AMBIENCE, this.ambFile);
    if (plan.fill) for (let k = 0; k < 4; k++) this.sfxAt('snare', t + (3.5 + k * 0.125) * beatSec(this.bpm), 1, TUNING.fillGain * (0.6 + 0.13 * k));
    if (plan.tick === 'soft' && this.tick) {
      for (let k = 0; k < TUNING.beatsPerBar; k++) {
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = this.tick; g.gain.value = TUNING.tickGain * (k === 0 ? 1.6 : 1);
        src.connect(g); g.connect(this.master); src.start(t + k * beatSec(this.bpm));
      }
    }
  }
  private sfxAt(kind: SfxKind, when: number, rate: number, gain: number): void {
    const buf = this.sfxBuf.get(kind);
    if (!this.ctx || !buf) return;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf; src.playbackRate.value = rate; g.gain.value = gain;
    src.connect(g); g.connect(this.master);
    src.start(when);
  }
  playSfx(kind: SfxKind, rate = 1): void { this.sfxAt(kind, 0, rate, TUNING.sfxGain); }
  pause(): void { if (this.state === 'running') { this.state = 'paused'; void this.ctx.suspend(); } }
  resume(): void { if (this.state === 'paused') { this.state = 'running'; void this.ctx.resume(); } }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const v of this.voices.values()) { try { v.src.stop(); } catch { /* stopped */ } }
    this.voices.clear();
    this.state = 'idle';
  }
  positionBeats(): number {
    if (!this.ctx || this.state === 'idle') return 0;
    return Math.max(0, (this.ctx.currentTime - this.origin) / beatSec(this.bpm));
  }
  setVolume(v: number): void { this.volume = v; if (this.master) this.master.gain.value = v * masterTrim(); }
  onInterrupted(): () => void { return () => {}; }
}
