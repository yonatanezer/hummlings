// App icon, adaptive icon layers, splash and store feature graphic, drawn by the same code as the game. Run: npx tsx scripts/build-icons.ts
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { IDLE_POSE, drawCreature } from '../src/ui/draw/creature';
import { gradientPaint, paint, radialPaint, type Canvas, type SkiaApi } from '../src/ui/draw/common';
import { loadStages } from './qa-lib';
import { renderPng } from './render-lib';

const pond = loadStages()[0]!;
const pick = (i: number) => pond.creatures[i]!;
const BUNNY = pick(3), BEAR = pick(10), AXO = pick(17);

function bg(sk: SkiaApi, c: Canvas, w: number, h: number) {
  c.drawRect(sk.XYWHRect(0, 0, w, h), gradientPaint(sk, 0, 0, 0, h, ['#3A2A7C', '#1B1340']));
  const p = sk.PathBuilder.Make();
  p.moveTo(w * 0.42, 0); p.lineTo(w * 0.58, 0); p.lineTo(w * 0.86, h); p.lineTo(w * 0.14, h); p.close();
  c.drawPath(p.build(), gradientPaint(sk, 0, 0, 0, h, ['#FFE8A3', '#00000000'], 0.28));
  c.drawOval(sk.XYWHRect(-w * 0.1, h * 0.7, w * 1.2, h * 0.5), gradientPaint(sk, 0, h * 0.7, 0, h, ['#5C4AA8', '#2A1F5C']));
}
function trio(sk: SkiaApi, c: Canvas, cx: number, floorY: number, S: number) {
  drawCreature(sk, c, BEAR, cx - S * 0.72, floorY + S * 0.02, S * 0.5, { ...IDLE_POSE, mouth: 0.4, tilt: -0.05 });
  drawCreature(sk, c, AXO, cx + S * 0.7, floorY + S * 0.02, S * 0.5, { ...IDLE_POSE, mouth: 0.6, tilt: 0.05 });
  drawCreature(sk, c, BUNNY, cx, floorY, S, { ...IDLE_POSE, mouth: 0.85 });
  for (const [dx, dy, r] of [[-0.62, -1.38, 22], [0.7, -1.3, 26], [0.1, -1.62, 18]] as const) c.drawCircle(cx + dx * S, floorY + dy * S, r, paint(sk, '#FFE8A3', 0.9));
}
const save = (f: string, b: Buffer) => writeFileSync(f, b);

async function main() {
  const N = 1024;
  save('assets/icon.png', await renderPng(N, N, (sk, c) => { bg(sk, c, N, N); trio(sk, c, N / 2, N * 0.8, 470); }));
  save('assets/android-icon-background.png', await renderPng(N, N, (sk, c) => bg(sk, c, N, N)));
  save('assets/android-icon-foreground.png', await renderPng(N, N, (sk, c) => trio(sk, c, N / 2, N * 0.7, 300))); // inside the 66% safe zone
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'assets/android-icon-foreground.png', '-vf', 'format=rgba,lutrgb=r=255:g=255:b=255', 'assets/android-icon-monochrome.png']);
  save('assets/splash-icon.png', await renderPng(N, N, (sk, c) => trio(sk, c, N / 2, N * 0.68, 340)));
  save('assets/favicon.png', await renderPng(96, 96, (sk, c) => { bg(sk, c, 96, 96); drawCreature(sk, c, BUNNY, 48, 84, 64, { ...IDLE_POSE, mouth: 0.6 }); }));
  save('assets/store/feature.png', await renderPng(1024, 500, (sk, c) => {
    bg(sk, c, 1024, 500);
    c.drawCircle(512, 250, 300, radialPaint(sk, 512, 250, 300, ['#FFFFFF', '#7A8CFF', '#00000000'], 0.16));
    [[pond.creatures[0]!, 120, 0.8], [pond.creatures[10]!, 290, 0.85], [BUNNY, 512, 1.15], [AXO, 735, 0.85], [pond.creatures[22]!, 905, 0.8]].forEach(([cr, x, k], i) => drawCreature(sk, c, cr as typeof BUNNY, x as number, 440, 230 * (k as number), { ...IDLE_POSE, mouth: i % 2 ? 0.7 : 0.2 }));
  }));
  console.log('icons done');
}
void main();
