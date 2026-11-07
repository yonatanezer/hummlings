// Design source for the 3 stages. `npm run content` turns this into content/stages/*.json
// (the fixed schema in src/core/schema.ts validates the result).
import type { Accessory, ChordSlot, EyeStyle, Layer, Look, Species, Stage } from '../src/core/types';

export interface StageDef {
  id: string;
  nameKey: string;
  bpm: number;
  key: Stage['key'];
  chords: ChordSlot[];
  palette: Stage['palette'];
  swing: number;
  /** Per-layer timbre names understood by scripts/synth.ts */
  timbre: { melody: 'pluck' | 'bell' | 'flute'; voiceBrightness: number; bass: 'round' | 'fat' | 'soft'; kit: 'lofi' | 'bouncy' | 'soft' };
  accessories: Accessory[]; // 4 flavour accessories for this world
  eyes: EyeStyle[];
  look: Look;
  species: Species[]; // 6 per world, rotated across layers
  kit: 'lofi' | 'bouncy' | 'soft'; // drum character
  hueShift: number; // degrees applied to creature colours so worlds feel different but layers stay recognisable
}

const ch = (bar: number, root: string, quality: ChordSlot['quality']): ChordSlot => ({ bar, root, quality });

export const STAGES: StageDef[] = [
  {
    id: 'pond', nameKey: 'stage.pond', bpm: 92, key: { root: 'A', mode: 'minor' },
    chords: [ch(0, 'A', 'min'), ch(1, 'F', 'maj'), ch(2, 'C', 'maj'), ch(3, 'G', 'maj')],
    palette: { sky: '#1B1340', floor: '#2A1F5C', glow: '#FFE8A3', accent: '#7A8CFF' },
    swing: 0, timbre: { melody: 'bell', voiceBrightness: 0.5, bass: 'round', kit: 'lofi' },
    accessories: ['flower', 'none', 'star', 'flower'], eyes: ['dots', 'big', 'sleepy', 'sparkle'],
    look: 'gummy', species: ['frog', 'axolotl', 'bird', 'bunny', 'mouse', 'bear'], kit: 'lofi',
    hueShift: 0,
  },
  {
    id: 'fair', nameKey: 'stage.fair', bpm: 112, key: { root: 'C', mode: 'major' },
    chords: [ch(0, 'C', 'maj'), ch(1, 'G', 'maj'), ch(2, 'A', 'min'), ch(3, 'F', 'maj')],
    palette: { sky: '#3A1346', floor: '#5C1F58', glow: '#FFD6E8', accent: '#FF7AA8' },
    swing: 0.12, timbre: { melody: 'pluck', voiceBrightness: 0.8, bass: 'fat', kit: 'bouncy' },
    accessories: ['hat', 'bow', 'crown', 'hat'], eyes: ['big', 'sparkle', 'dots', 'sleepy'],
    look: 'candy', species: ['cat', 'fox', 'mouse', 'dino', 'bear', 'bunny'], kit: 'bouncy',
    hueShift: 10,
  },
  {
    id: 'clouds', nameKey: 'stage.clouds', bpm: 84, key: { root: 'D', mode: 'major' },
    chords: [ch(0, 'D', 'maj7'), ch(1, 'B', 'min7'), ch(2, 'G', 'maj7'), ch(3, 'A', 'dom7')],
    palette: { sky: '#12304A', floor: '#1F4A6E', glow: '#D6F0FF', accent: '#5FE3C0' },
    swing: 0.05, timbre: { melody: 'flute', voiceBrightness: 0.3, bass: 'soft', kit: 'soft' },
    accessories: ['scarf', 'star', 'none', 'scarf'], eyes: ['sleepy', 'dots', 'sparkle', 'big'],
    look: 'cloud', species: ['sheep', 'bunny', 'bird', 'bear', 'cat', 'axolotl'], kit: 'soft',
    hueShift: -10,
  },
];

export const LAYER_ORDER: Layer[] = ['drums', 'bass', 'melody', 'voice'];
export const BODY_OF: Record<Layer, 'round' | 'wide' | 'tall' | 'small'> = { drums: 'round', bass: 'wide', melody: 'tall', voice: 'small' };
