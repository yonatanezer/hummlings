import { writeFileSync } from 'node:fs';
import { loadStages } from './qa-lib';
import { renderPng } from './render-lib';
import { drawCreature, IDLE_POSE } from '../src/ui/draw/creature';

async function main() {
  const stage = loadStages()[0]!;
  const png = await renderPng(900, 520, (sk, c) => {
    c.clear(sk.Color(stage.palette.sky));
    stage.creatures.forEach((cr, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      drawCreature(sk, c, cr, 120 + col * 220, 150 + row * 125, 100, { ...IDLE_POSE, mouth: i % 3 === 0 ? 0.8 : 0 });
    });
  }, 1);
  writeFileSync(process.argv[2] ?? '/tmp/creatures.png', png);
}
void main();
