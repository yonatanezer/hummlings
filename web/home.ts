// Web demo opening screen: six singers drop onto a hill one after another (each lands on a note of a rising scale and pops the next letters of the
// title in); afterwards touch a singer, or slide over several, and it hops and sings its note. Same idea as the app's intro and home screen.
import { blinkOpen } from '../src/core/anim';
import { HERO_COUNT, HERO_NOTES, HERO_PICKS } from '../src/core/hero';
import type { Creature } from '../src/core/types';
import type { WebEngine } from './engine';

const CELL_W = 220, CELL_H = 240, FEET_X = 110, FEET_Y = 222, SPRITE_S = 120;
const GAP = 300, FALL = 420, HIT_MS = 1000;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeOutBounce = (k: number): number => {
  const n1 = 7.5625, d1 = 2.75;
  if (k < 1 / d1) return n1 * k * k;
  if (k < 2 / d1) { const q = k - 1.5 / d1; return n1 * q * q + 0.75; }
  if (k < 2.5 / d1) { const q = k - 2.25 / d1; return n1 * q * q + 0.9375; }
  const q = k - 2.625 / d1;
  return n1 * q * q + 0.984375;
};

interface Hit { i: number; t: number }

export function initHome(opts: { splash: HTMLElement; canvas: HTMLCanvasElement; title: HTMLElement; engine: WebEngine; creatures: Creature[]; atlasUrl: string }): void {
  const { splash, canvas, title, engine } = opts;
  const g = canvas.getContext('2d')!;
  const singers = HERO_PICKS.map((i) => ({ cr: opts.creatures[i]!, row: i }));
  let atlas: HTMLImageElement | null = null;
  const img = new Image();
  img.onload = () => { atlas = img; };
  img.src = opts.atlasUrl;
  void engine.init().catch(() => undefined); // decode the sounds now (the browser keeps the audio context suspended until the first touch)

  // Title: one span per letter, popped in as the singers land.
  const text = title.getAttribute('aria-label') ?? title.textContent ?? '';
  const letters = Array.from(text);
  title.textContent = '';
  letters.forEach((ch, k) => {
    const landing = Math.min(HERO_COUNT - 1, Math.floor((k * HERO_COUNT) / letters.length));
    const span = document.createElement('span');
    span.textContent = ch;
    span.style.animationDelay = `${still ? 0 : 200 + FALL + landing * GAP}ms`;
    title.appendChild(span);
  });
  const sub = splash.querySelector<HTMLElement>('#homeSub');
  if (sub && !still) { sub.style.opacity = '0'; setTimeout(() => { sub.style.transition = 'opacity .6s'; sub.style.opacity = '1'; }, 200 + FALL + (HERO_COUNT - 1) * GAP + 200); }
  const swell = () => { title.style.transform = 'scale(1.14)'; setTimeout(() => { title.style.transform = ''; }, 120); };

  const t0 = performance.now();
  let hits: Hit[] = [];
  let W = 0, H = 0;
  const xs: number[] = [], ys: number[] = [];
  let S = 80;
  const layout = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.max(46, Math.min(H * 0.27, (W * 0.9) / 6.6));
    const feet = H - Math.max(96, H * 0.26);
    xs.length = 0; ys.length = 0;
    for (let i = 0; i < HERO_COUNT; i++) {
      const t = (i + 0.5) / HERO_COUNT;
      xs.push(W * (0.05 + 0.9 * t));
      ys.push(feet - Math.sin(Math.PI * t) * S * 0.16);
    }
  };
  layout();
  addEventListener('resize', layout);

  const hitTest = (x: number, y: number): number => {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < HERO_COUNT; i++) {
      const dx = Math.abs(x - xs[i]!), d = Math.hypot(dx, (y - (ys[i]! - S * 0.5)) * 0.8);
      if (dx < S * 0.62 && d < S * 0.85 && d < bestD) { best = i; bestD = d; }
    }
    return best;
  };
  let last = -1;
  const sing = (e: PointerEvent) => {
    const i = hitTest(e.clientX, e.clientY);
    if (i < 0) { last = -1; return; }
    if (i === last) return;
    last = i;
    void engine.ctx?.resume(); // the first touch unlocks the sound
    const now = performance.now();
    hits = [...hits.filter((h) => now - h.t < HIT_MS + 100), { i, t: now }];
    engine.playSfx('pop', HERO_NOTES[i]!);
    swell();
  };
  splash.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement).closest('button')) return; sing(e); });
  splash.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') sing(e); });
  splash.addEventListener('pointerup', () => { last = -1; });
  splash.addEventListener('pointercancel', () => { last = -1; });

  const sprite = (row: number, pose: number, x: number, y: number, o: { sx: number; sy: number; lift: number; tilt: number }) => {
    if (!atlas) return;
    const k = S / SPRITE_S;
    g.save();
    g.translate(x, y - o.lift);
    g.rotate(o.tilt);
    g.scale(o.sx * k, o.sy * k);
    g.drawImage(atlas, pose * CELL_W, row * CELL_H, CELL_W, CELL_H, -FEET_X, -FEET_Y, CELL_W, CELL_H);
    g.restore();
  };

  const draw = (now: number) => {
    if (splash.classList.contains('hide')) return; // the stage took over
    requestAnimationFrame(draw);
    const time = now - t0;
    g.clearRect(0, 0, W, H);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2E1F73'); bg.addColorStop(0.6, '#1B1340'); bg.addColorStop(1, '#120C2E');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { // stars
      const a = Math.sin(i * 127.1) * 43758.5453, b = Math.sin(i * 311.7) * 12543.321;
      g.globalAlpha = (0.25 + ((i * 13) % 7) * 0.08) * (still ? 1 : 0.7 + 0.3 * Math.sin(time / 700 + i));
      g.fillStyle = i % 6 === 0 ? '#FFE8A3' : '#FFFFFF';
      g.beginPath(); g.arc((a - Math.floor(a)) * W, (b - Math.floor(b)) * H * 0.7, 0.8 + ((i * 7) % 5) * 0.45, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // hill
    const hy = ys[0]! - S * 0.34;
    const hg = g.createLinearGradient(0, hy, 0, H * 1.1);
    hg.addColorStop(0, '#4A3796'); hg.addColorStop(0.45, '#241A5C'); hg.addColorStop(1, '#150E3A');
    g.fillStyle = hg; g.beginPath(); g.ellipse(W / 2, hy + H * 0.65, W * 0.62, H * 0.65, 0, 0, Math.PI * 2); g.fill();

    for (let i = 0; i < HERO_COUNT; i++) {
      const x = xs[i]!, y = ys[i]!;
      let drop = 0, land = -1;
      if (!still) {
        const k = (time - 200 - i * GAP) / FALL;
        if (k < 0) continue;
        if (k < 1) drop = (1 - easeOutBounce(k)) * (y + S * 2.2);
        else land = (k - 1) * FALL;
      }
      const breathe = still ? 0 : Math.sin(time / 640 + i * 1.7);
      let lift = Math.max(0, breathe) * S * 0.03, sy = 1 + breathe * 0.025, sx = 1 - breathe * 0.015, tilt = 0, singing = false;
      let age = -1;
      for (const h of hits) if (h.i === i && now - h.t >= 0 && now - h.t < HIT_MS) age = now - h.t;
      if (age >= 0) {
        const p = Math.min(1, age / 420);
        lift += Math.sin(p * Math.PI) * S * 0.38; sy *= 1 + Math.sin(p * Math.PI) * 0.1; sx *= 1 - Math.sin(p * Math.PI) * 0.06;
        singing = age < 700;
        tilt = Math.sin(age / 90) * 0.07 * Math.max(0, 1 - age / 700);
      }
      if (land >= 0 && land < 220) { const q = land / 220; sy *= 1 - Math.sin(q * Math.PI) * 0.16; sx *= 1 + Math.sin(q * Math.PI) * 0.1; singing = true; }
      g.fillStyle = `rgba(10,6,32,${0.35 * (drop > 0 ? 0.4 : 1)})`;
      g.beginPath(); g.ellipse(x, y + S * 0.01, S * 0.42, S * 0.06, 0, 0, Math.PI * 2); g.fill();
      const swayV = still ? 1 : Math.sin(time / 170 + i) > 0.35 ? 0 : Math.sin(time / 170 + i) < -0.35 ? 2 : 1;
      const blink = blinkOpen(time + i * 977, i * 977 + 13) < 0.5;
      const pose = (singing ? 1 : blink ? 2 : 0) * 3 + swayV;
      sprite(singers[i]!.row, pose, x, y - drop, { sx, sy, lift, tilt });
    }
    // notes rising from touched singers
    for (const h of hits) {
      const age = now - h.t;
      if (age < 0 || age >= HIT_MS) continue;
      const k = age / HIT_MS;
      for (let n = 0; n < 3; n++) {
        const kk = Math.min(1, Math.max(0, k * 1.15 - n * 0.12));
        if (kk <= 0) continue;
        const nx = xs[h.i]! + Math.sin(kk * 5 + n * 2.1) * S * 0.28 + (n - 1) * S * 0.25, ny = ys[h.i]! - S * (1.3 + kk * 0.8);
        const r = S * (0.085 + 0.02 * n);
        g.globalAlpha = Math.sin(kk * Math.PI) * 0.95;
        g.fillStyle = n === 1 ? '#FFE8A3' : '#9FE8FF';
        g.beginPath(); g.arc(nx, ny, r, 0, Math.PI * 2); g.fill();
        g.fillRect(nx + r * 0.7, ny - r * 3.6, r * 0.42, r * 3.6);
      }
      g.globalAlpha = 1;
    }
  };
  requestAnimationFrame(draw);
}
