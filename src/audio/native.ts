import { AudioContext, AudioManager } from 'react-native-audio-api';
import type { AudioBuffer, AudioBufferSourceNode, GainNode } from 'react-native-audio-api';
import type { AudioEngine, BarPlan, BarProvider, EngineState } from '../core/engine';
import { softClipCurve } from '../core/mix';
import { TUNING, barSec, beatSec, masterTrim } from '../core/tuning';
import type { Stage } from '../core/types';
import { LOOP_ASSETS } from '../content/loopAssets';
import { SFX_TICK, SFX_TICK_ACCENT } from '../content/sfxAssets';

const LOOKAHEAD_S = 0.15; // schedule bars this far ahead of the audio clock
const TIMER_MS = 25;
const START_DELAY_S = 0.12; // gap between start() and bar 0
const BONUS = '__bonus';

interface Voice { src: AudioBufferSourceNode; gain: GainNode }

/** Sample-accurate engine on react-native-audio-api: looped PCM buffers scheduled on one shared AudioContext clock. */
export class NativeEngine implements AudioEngine {
  state: EngineState = 'idle';
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<string, Voice>();
  private tickBuf: AudioBuffer | null = null;
  private tickAccentBuf: AudioBuffer | null = null;
  private origin = 0;
  private nextBar = 0;
  private bpm = 100;
  private provider: BarProvider | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private volume = 0.8;
  private interrupted = new Set<() => void>();
  private fileIndex = new Map<string, string>(); // creature id -> loop file

  async init(): Promise<void> {
    if (this.ctx) return;
    // Plays with the iOS silent switch (music app); no recording, no microphone.
    AudioManager.setSystemOptions({ ios: { category: 'playback', mode: 'default' } });
    AudioManager.observeAudioInterruptions(true);
    AudioManager.addSystemEventListener('interruption', (e) => {
      if (e.type === 'began') { this.pause(); this.interrupted.forEach((l) => l()); }
    });
    await AudioManager.setAudioSessionActivity(true);
    const ctx = new AudioContext({ sampleRate: TUNING.sampleRate });
    const master = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClipCurve();
    master.connect(shaper);
    shaper.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.setVolume(this.volume);
    this.tickBuf = await ctx.decodeAudioData(SFX_TICK);
    this.tickAccentBuf = await ctx.decodeAudioData(SFX_TICK_ACCENT);
  }

  async loadStage(stage: Stage): Promise<void> {
    const ctx = this.ctx!;
    this.fileIndex = new Map(stage.creatures.map((c) => [c.id, c.loopFile]));
    const files = [...stage.creatures.map((c) => c.loopFile), ...stage.combos.map((c) => c.bonusLoopFile)];
    await Promise.all(files.filter((f) => !this.buffers.has(f)).map(async (f) => {
      this.buffers.set(f, await ctx.decodeAudioData(LOOP_ASSETS[f]!));
    }));
    // Memory cap: keep only this stage's buffers.
    for (const k of [...this.buffers.keys()]) if (!files.includes(k)) this.buffers.delete(k);
  }

  async decodeBank(files: string[], loopSamples: number): Promise<Record<string, Float32Array>> {
    const ctx = this.ctx!;
    const out: Record<string, Float32Array> = {};
    for (const f of files) {
      const buf = await ctx.decodeAudioData(LOOP_ASSETS[f]!);
      const ch = buf.getChannelData(0);
      const a = new Float32Array(loopSamples);
      a.set(ch.subarray(0, Math.min(loopSamples, ch.length)));
      out[f] = a;
    }
    return out;
  }

  start(bpm: number, provider: BarProvider): void {
    this.stop();
    const ctx = this.ctx!;
    this.bpm = bpm; this.provider = provider; this.nextBar = 0;
    this.origin = ctx.currentTime + START_DELAY_S;
    this.state = 'running';
    void ctx.resume();
    this.timer = setInterval(() => this.pump(), TIMER_MS);
    this.pump();
  }

  private pump(): void {
    const ctx = this.ctx;
    if (!ctx || this.state !== 'running' || !this.provider) return;
    const bs = barSec(this.bpm);
    while (this.origin + this.nextBar * bs < ctx.currentTime + LOOKAHEAD_S) {
      const bar = this.nextBar++;
      this.apply(bar, this.origin + bar * bs, this.provider(bar));
    }
  }

  private apply(bar: number, t: number, plan: BarPlan): void {
    const ctx = this.ctx!;
    const bs = barSec(this.bpm);
    const wanted = new Set(plan.ids);
    if (plan.bonusFile) wanted.add(BONUS);
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
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = bs * TUNING.loopBars; // exact loop length: absorbs any encoder padding at the end of the file
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + TUNING.fadeInMs / 1000);
      src.connect(gain);
      gain.connect(this.master!);
      // Always in phase with the global clock: a late joiner enters at its place in the 4-bar chord loop.
      src.start(t, (bar % TUNING.loopBars) * bs);
      this.voices.set(key, { src, gain });
    };
    for (const id of plan.ids) launch(id, this.fileOf(id));
    if (plan.bonusFile) launch(BONUS, plan.bonusFile);
    if (plan.tick === 'soft') {
      for (let k = 0; k < TUNING.beatsPerBar; k++) {
        const src = ctx.createBufferSource();
        const g = ctx.createGain();
        src.buffer = k === 0 ? this.tickAccentBuf : this.tickBuf;
        g.gain.value = TUNING.tickGain;
        src.connect(g);
        g.connect(this.master!);
        src.start(t + k * beatSec(this.bpm));
      }
    }
  }

  private fileOf(id: string): string { return this.fileIndex.get(id) ?? ''; }

  pause(): void { if (this.state === 'running') { this.state = 'paused'; void this.ctx?.suspend(); } }
  resume(): void { if (this.state === 'paused') { this.state = 'running'; void this.ctx?.resume(); } }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const v of this.voices.values()) { try { v.src.stop(); } catch { /* already stopped */ } }
    this.voices.clear();
    this.state = 'idle';
  }
  positionBeats(): number {
    const ctx = this.ctx;
    if (!ctx || this.state === 'idle') return 0;
    const latency = (ctx as unknown as { outputLatency?: number }).outputLatency ?? 0;
    return Math.max(0, (ctx.currentTime - latency - this.origin) / beatSec(this.bpm));
  }
  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v * masterTrim();
  }
  onInterrupted(cb: () => void): () => void { this.interrupted.add(cb); return () => this.interrupted.delete(cb); }
}
