import { gradientPaint, radialPaint, type Canvas, type SkiaApi, rect } from './common';

/** Home screen backdrop: night sky, one soft glow per world colour, a moon, deterministic stars and a hill. Drawn once into a picture. */
export function drawHomeBackdrop(sk: SkiaApi, c: Canvas, w: number, h: number) {
  'worklet';
  c.drawRect(rect(0, 0, w, h), gradientPaint(sk, 0, 0, 0, h, ['#2E1F73', '#1B1340', '#120C2E']));
  const glows: [number, string][] = [[0.1, '#5B7CFF'], [0.3, '#FF7AA8'], [0.5, '#7A6BFF'], [0.7, '#35D6C0'], [0.9, '#FFC46B']];
  glows.forEach(([x, col], i) => {
    const r = Math.max(w, h) * 0.34;
    c.drawCircle(w * x, h * (0.58 + (i % 2) * 0.12), r, radialPaint(sk, w * x, h * 0.62, r, [col, '#00000000'], 0.2));
  });
  // moon
  c.drawCircle(w * 0.5, h * 0.2, Math.min(w, h) * 0.2, radialPaint(sk, w * 0.5, h * 0.2, Math.min(w, h) * 0.2, ['#FFF6D8', '#FFE8A300'], 0.14));
  // stars (hash-placed, no Math.random so the picture is stable)
  const star = sk.Paint();
  star.setAntiAlias(true);
  for (let i = 0; i < 70; i++) {
    const a = Math.sin(i * 127.1) * 43758.5453;
    const b = Math.sin(i * 311.7) * 12543.321;
    const x = (a - Math.floor(a)) * w;
    const y = (b - Math.floor(b)) * h * 0.78;
    const s = 0.8 + ((i * 7) % 5) * 0.45;
    star.setColor(sk.Color(i % 6 === 0 ? '#FFE8A3' : '#FFFFFF'));
    star.setAlphaf(0.25 + ((i * 13) % 7) * 0.08);
    c.drawCircle(x, y, s, star);
  }
}
