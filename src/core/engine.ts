import type { Stage } from './types';

/** What should sound from a given bar on. Provided by the Session, applied by the engine at the bar boundary. */
export interface BarPlan {
  ids: string[]; // creature ids audible from this bar
  bonusFile: string | null; // combo bonus loop playing during this bar
  tick: 'off' | 'soft'; // beat tick (empty stage / first-run count)
}

export type BarProvider = (bar: number) => BarPlan;

export type EngineState = 'idle' | 'running' | 'paused';

/**
 * The audio engine plays looped buffers on one shared clock. Native implementation: react-native-audio-api.
 * Mock implementation: virtual clock for tests and the web check build.
 */
export interface AudioEngine {
  init(): Promise<void>;
  /** Decode every loop of the stage (and the tick). */
  loadStage(stage: Stage): Promise<void>;
  /** Starts the clock at bar 0 (first boundary ~100 ms from now) and begins asking `provider` for each bar. */
  start(bpm: number, provider: BarProvider): void;
  pause(): void;
  resume(): void;
  stop(): void;
  /** Position in beats since start (float), compensated for output latency. Safe to call every frame. */
  positionBeats(): number;
  setVolume(v: number): void;
  readonly state: EngineState;
  /** Fires on interruption (call, other audio, headphones unplugged) or background. */
  onInterrupted(cb: () => void): () => void;
}
