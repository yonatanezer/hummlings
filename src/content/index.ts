import type { Stage } from '../core/types';
import { validateStage } from '../core/schema';
import pond from '../../content/stages/1-pond.json';
import fair from '../../content/stages/2-fair.json';
import clouds from '../../content/stages/3-clouds.json';
import neon from '../../content/stages/4-neon.json';
import frost from '../../content/stages/5-frost.json';

const raw = [pond, fair, clouds, neon, frost];

export const STAGES: Stage[] = raw.map((r) => {
  const { stage, errors } = validateStage(r);
  if (!stage || errors.length) throw new Error(`Invalid stage content: ${errors.join('; ')}`);
  return stage;
});

/** Stage 1 is free; the rest need the unlock. */
export const FREE_STAGE_IDS: readonly string[] = ['pond'];
export const getStage = (id: string): Stage => {
  const s = STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown stage ${id}`);
  return s;
};
