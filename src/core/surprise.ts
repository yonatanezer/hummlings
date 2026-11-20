import type { Layer, Stage } from './types';
import { LAYERS } from './types';

/** A random six-singer band: one of every layer plus two more, so it always has a beat, a bass, a tune and a voice. */
export function randomBand(stage: Stage, rand: () => number = Math.random): string[] {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
  const byLayer = (l: Layer) => stage.creatures.filter((c) => c.layer === l);
  const band: string[] = LAYERS.map((l) => pick(byLayer(l)).id);
  while (band.length < 6) {
    const c = pick(stage.creatures);
    if (!band.includes(c.id)) band.push(c.id);
  }
  // shuffle so the layers do not always stand in the same places
  for (let i = band.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [band[i], band[j]] = [band[j]!, band[i]!];
  }
  return band;
}
