import { writeFileSync } from 'node:fs';
import { loadStages } from './qa-lib';
import { renderPng } from './render-lib';
import { drawCreature, IDLE_POSE } from '../src/ui/draw/creature';
import { gradientPaint } from '../src/ui/draw/common';
async function main() {
  const stages = loadStages();
  const png = await renderPng(1200, 760, (sk, c) => {
    stages.forEach((st, si) => {
      c.save(); c.translate(0, si * 250);
      c.drawRect(sk.XYWHRect(0, 0, 1200, 250), gradientPaint(sk, 0, 0, 0, 250, [st.palette.sky, st.palette.floor]));
      [0, 6, 12, 18, 3, 9, 15, 21].forEach((i, k) => drawCreature(sk, c, st.creatures[i]!, 80 + k * 145, 190, 100, { ...IDLE_POSE, mouth: k % 2 ? 0.7 : 0, time: 1000 * k }));
      c.restore();
    });
  }, 1);
  writeFileSync(process.argv[2]!, png);
}
void main();
