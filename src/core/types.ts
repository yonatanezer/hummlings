export type Layer = 'drums' | 'bass' | 'melody' | 'voice';
export const LAYERS: readonly Layer[] = ['drums', 'bass', 'melody', 'voice'] as const;

/** Layer colours are consistent on every stage (art direction). */
export const LAYER_COLORS: Record<Layer, string> = {
  drums: '#FF7AA8',
  bass: '#7A8CFF',
  melody: '#5FE3C0',
  voice: '#FFC857',
};

export type BodyShape = 'round' | 'wide' | 'tall' | 'small';
export type EyeStyle = 'dots' | 'big' | 'sleepy' | 'sparkle';
export type Species = 'cat' | 'bunny' | 'bear' | 'mouse' | 'frog' | 'bird' | 'dino' | 'axolotl' | 'sheep' | 'fox';
export const SPECIES: readonly Species[] = ['cat', 'bunny', 'bear', 'mouse', 'frog', 'bird', 'dino', 'axolotl', 'sheep', 'fox'];
/** Material of a world's creatures: glossy gummy, striped sprinkle candy, or soft fluffy cloud. */
export type Look = 'gummy' | 'candy' | 'cloud';
export type Accessory = 'none' | 'bow' | 'hat' | 'crown' | 'flower' | 'scarf' | 'star';

export interface ShapeParams {
  body: BodyShape;
  eyes: EyeStyle;
  species: Species;
  accessory: Accessory;
  look: Look;
}

export interface Creature {
  id: string;
  layer: Layer;
  loopFile: string; // path relative to assets/loops
  onsets: number[]; // beat positions within the 16-beat loop that drive mouth / beat animation
  color: string;
  shape: ShapeParams;
}

export interface Combo {
  id: string;
  creatureIds: [string, string, string, string];
  bonusLoopFile: string;
  celebrationId: string;
}

export interface ChordSlot {
  bar: number; // 0..loopBars-1
  root: string; // e.g. "A"
  quality: 'maj' | 'min' | 'maj7' | 'min7' | 'dom7';
}

export interface StagePalette {
  sky: string; // background base
  floor: string; // stage floor
  glow: string; // spotlight tint
  accent: string; // UI accent for this stage
}

export interface Stage {
  id: string;
  nameKey: string;
  bpm: number;
  key: { root: string; mode: 'major' | 'minor' };
  timeSignature: '4/4';
  loopBars: number;
  chordLoop: ChordSlot[];
  palette: StagePalette;
  ambienceFile: string; // quiet looping bed that gives the world its own atmosphere
  creatures: Creature[];
  combos: Combo[];
}
