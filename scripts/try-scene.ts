import { writeFileSync } from 'node:fs';
import { loadStages } from './qa-lib';
import { renderPng } from './render-lib';
import { computeLayout } from '../src/core/layout';
import { drawScene, type SceneInput } from '../src/ui/draw/scene';

async function main() {
  const stage = loadStages()[0]!;
  const layout = computeLayout(844, 390);
  const ids = [0, 5, 10, 14, 3, 8].map((i) => stage.creatures[i]!.id);
  const s: SceneInput = {
    layout, stage, placed: ids.map((id, spot) => ({ id, spot, since: -5000, from: layout.slotPos[0]! })),
    muted: { [ids[1]!]: true }, solo: null, drags: [], returning: [], scrollX: 0, beat: 8.1, timeMs: 3000, reduceMotion: false,
    celebration: null, hint: false, recordingBeat: null, hintSlot: 0,
  };
  const variant = process.argv[3] ?? 'normal';
  if (variant === 'solo') s.solo = ids[2]!;
  if (variant === 'cel') s.celebration = { celebrationId: 'cel_pond_1', creatureIds: ids.slice(0, 4), startBeat: 2 };
  if (variant === 'hint') { s.placed = []; s.hint = true; s.timeMs = 1800; }
  const png = await renderPng(844, 390, (sk, c) => drawScene(sk, c, s), 2);
  writeFileSync(process.argv[2] ?? '/tmp/scene.png', png);
}
void main();
