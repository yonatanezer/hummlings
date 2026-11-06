import { z } from 'zod';
import { LAYERS, type Stage } from './types';
import { TUNING } from './tuning';

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const id = z.string().regex(/^[a-z0-9][a-z0-9_]*$/);

const creatureSchema = z.object({
  id,
  layer: z.enum(['drums', 'bass', 'melody', 'voice']),
  loopFile: z.string().min(1),
  onsets: z.array(z.number().min(0).lt(TUNING.beatsPerBar * TUNING.loopBars)).min(1),
  color: hex,
  shape: z.object({
    body: z.enum(['round', 'wide', 'tall', 'small']),
    eyes: z.enum(['dots', 'big', 'sleepy', 'sparkle']),
    ears: z.enum(['none', 'pointy', 'round', 'floppy', 'antenna']),
    accessory: z.enum(['none', 'bow', 'hat', 'crown', 'flower', 'glasses', 'scarf', 'star']),
  }),
});

const comboSchema = z.object({
  id,
  creatureIds: z.tuple([id, id, id, id]),
  bonusLoopFile: z.string().min(1),
  celebrationId: id,
});

export const stageSchema = z.object({
  id,
  nameKey: z.string().min(1),
  bpm: z.number().int().min(84).max(112),
  key: z.object({ root: z.string().regex(/^[A-G][#b]?$/), mode: z.enum(['major', 'minor']) }),
  timeSignature: z.literal('4/4'),
  loopBars: z.literal(TUNING.loopBars),
  chordLoop: z
    .array(
      z.object({
        bar: z.number().int().min(0).max(TUNING.loopBars - 1),
        root: z.string().regex(/^[A-G][#b]?$/),
        quality: z.enum(['maj', 'min', 'maj7', 'min7', 'dom7']),
      }),
    )
    .length(TUNING.loopBars),
  palette: z.object({ sky: hex, floor: hex, glow: hex, accent: hex }),
  creatures: z.array(creatureSchema).length(16),
  combos: z.array(comboSchema).length(3),
});

/** Validates one stage and its cross-references. Returns a list of problems (empty = valid). */
export function validateStage(raw: unknown): { stage?: Stage; errors: string[] } {
  const parsed = stageSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  const stage = parsed.data as Stage;
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const c of stage.creatures) {
    if (ids.has(c.id)) errors.push(`duplicate creature id ${c.id}`);
    ids.add(c.id);
  }
  for (const layer of LAYERS) {
    const n = stage.creatures.filter((c) => c.layer === layer).length;
    if (n !== 4) errors.push(`layer ${layer} has ${n} creatures, expected 4`);
  }
  const bars = new Set(stage.chordLoop.map((c) => c.bar));
  if (bars.size !== TUNING.loopBars) errors.push('chordLoop must cover each bar once');
  const comboIds = new Set<string>();
  for (const combo of stage.combos) {
    if (comboIds.has(combo.id)) errors.push(`duplicate combo id ${combo.id}`);
    comboIds.add(combo.id);
    if (new Set(combo.creatureIds).size !== 4) errors.push(`combo ${combo.id} repeats a creature`);
    for (const cid of combo.creatureIds) {
      if (!ids.has(cid)) errors.push(`combo ${combo.id} references unknown creature ${cid}`);
    }
  }
  return { stage, errors };
}
