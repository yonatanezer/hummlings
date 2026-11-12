// All tuning values live here. Pure data, no UI imports. Each value says why it is what it is.

export const TUNING = {
  // ---- Music grid ----
  beatsPerBar: 4, // 4/4 everywhere, decided in the spec
  loopBars: 4, // every loop is 4 bars so combinations always re-align
  maxSpots: 6, // 6 spots on stage, spec
  perLayer: 6, // creatures per layer per world (v1 was 4; widened so every world is rich from the first minute)
  creaturesPerStage: 24, // 4 layers x perLayer
  combosPerStage: 4, // secret combinations per world
  sampleRate: 48000, // loops are authored and decoded at 48 kHz

  // ---- Audio feel ----
  fadeInMs: 20, // new layer fade-in: long enough to avoid a click, short enough to hit the downbeat
  fadeOutMs: 40, // removal / mute fade-out
  masterLimiterDb: -1, // soft limiter ceiling (dBFS)
  maxGainReductionDb: 6, // audit fails if the limiter works harder than this
  masterTrimDb: -8, // headroom before the limiter: six loops at -20 LUFS peak ~10 dB over the ceiling without it
  targetLufs: -20, // each loop is normalised to this loudness
  lufsTolerance: 1, // +/- LU allowed by the audit
  sfxGain: 0.5, // UI sounds sit under the music
  fillGain: 0.35, // drum fill at the end of a 4-bar loop
  tickGain: 0.12, // soft beat tick on an empty stage: audible but never annoying
  countInGain: 0.1, // first-run hi-hat count, softer than a tick

  // ---- Interaction ----
  longPressMs: 400, // solo threshold, spec
  soloDimOpacity: 0.3, // everyone else while a soloist is active
  mutedOpacity: 0.4, // muted creature
  feedbackMaxMs: 100, // every touch answers visually within this
  minTouchPt: 56, // creatures / buttons on tablets and small phones, spec edge case
  flickDownVelocity: 900, // px/s downwards that counts as "flick it off"
  dragLift: 1.15, // scale of a creature while carried: reads as "picked up"

  // ---- Animation ----
  beatSquash: 0.08, // 8% squash-stretch on each beat, spec
  downbeatSquash: 0.14, // bar 1 hits harder so the loop start is felt
  breathPeriodMs: 3200, // slow idle breathing, calmer than the beat
  blinkMinMs: 3000, // spec: blink every 3-6 s at random
  blinkMaxMs: 6000,
  hopMs: 320, // hop onto the stage

  // ---- Combos ----
  comboCheckEveryBars: 1, // check at each bar boundary
  comboWaitLoops: 1, // after all 4 are present, one full loop passes first
  celebrationBars: 8, // 8-bar animated show
  confettiMax: 120, // hard cap on particles so 60 fps holds

  // ---- Recording ----
  maxRecordingSec: 180, // 3 minutes, spec
  recordingWarnSec: 10, // visual warning before the limit
  maxSongs: 50, // spec
  songNameMax: 24, // spec

  // ---- Purchases / parental gate ----
  gateHoldMs: 2000, // hold for 2 s while solving the sum
  gateMaxAddend: 9, // two digits added: both addends 1-9 (result may have 2 digits)
  unlockProductId: 'hummlings.unlock_all',

  // ---- Performance caps ----
  maxBuffersDecoded: 40, // one world at a time: 24 loops + 4 bonus + tick
  targetFps: 60,
} as const;

/** Linear master trim applied before the limiter, live and in export. */
export const masterTrim = (): number => Math.pow(10, TUNING.masterTrimDb / 20);

/** Seconds per beat for a given tempo. */
export const beatSec = (bpm: number): number => 60 / bpm;
/** Seconds per bar in 4/4. */
export const barSec = (bpm: number): number => beatSec(bpm) * TUNING.beatsPerBar;
/** Seconds of one full loop. */
export const loopSec = (bpm: number): number => barSec(bpm) * TUNING.loopBars;
