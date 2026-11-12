import type { Stage } from './types';

/** What should sound from a given bar on. Provided by the Session, applied by the engine at the bar boundary. */
export type SfxKind = 'pickup' | 'pop' | 'mute' | 'unmute' | 'remove' | 'goal' | 'combo' | 'snare';

export interface BarPlan {
  ids: string[]; // creature ids audible from this bar
  bonusFile: string | null; // combo bonus loop playing during this bar
  tick: 'off' | 'soft'; // beat tick (empty stage / first-run count)
  gains: Record<string, number>; // per-creature level 0..1 (missing = 1)
  fill: boolean; // a short drum fill on the last beat of the bar (end of a 4-bar loop with a fuller band)
}

export type BarProvider = (bar: number) => BarPlan;

export type EngineState = 'idle' | 'running' | 'paused';

/**
 * The audio engine plays looped buffers on one shared clock. Native implementation: react-native-audio-api.
 * Mock implementation: virtual clock for tests and the web check build.
 */
export interface AudioEngine {
  init(): Promise<void>;
  /** Decode every loop of the stage (and the tick). With `background` it may resolve once the world's bed is ready and keep decoding the singers' loops while the stage plays. */
  loadStage(stage: Stage, opts?: { background?: boolean }): Promise<void>;
  /** Decodes loops to mono Float32 at 48 kHz, each trimmed to exactly `loopSamples` (used by song export). */
  decodeBank(files: string[], loopSamples: number): Promise<Record<string, Float32Array>>;
  /** Starts the clock at bar 0 (first boundary ~100 ms from now) and begins asking `provider` for each bar. */
  start(bpm: number, provider: BarProvider): void;
  pause(): void;
  resume(): void;
  stop(): void;
  /** Position in beats since start (float), compensated for output latency. Safe to call every frame. */
  positionBeats(): number;
  /** Plays a short UI sound right now. `rate` re-pitches it (semitone ratio) so drops sound musical in the stage key. */
  playSfx(kind: SfxKind, rate?: number): void;
  /** Changes one voice's level right now (smoothed). Used while dragging the volume slider. */
  setVoiceGain(creatureId: string, gain: number): void;
  setVolume(v: number): void;
  readonly state: EngineState;
  /** Fires on interruption (call, other audio, headphones unplugged) or background. */
  onInterrupted(cb: () => void): () => void;
}
