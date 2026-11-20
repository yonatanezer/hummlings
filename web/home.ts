// Web demo home screen: the same screen as the app's (StageSelectScreen). The sky and the singers are drawn by the app's own drawing code (through CanvasKit);
// the logo, buttons, world cards and little planets are the artist's pictures. Touch a singer (or slide over several) and it hops and sings its note.
import { drawHero, HERO_NOTES, heroGeometry, heroHitTest, paddedGeo, type HeroHit } from '../src/ui/draw/hero';
import { drawHomeBackdrop } from '../src/ui/draw/home';
import { CARD_BY_STAGE_INDEX } from '../src/ui/homeCardOrder';
import { HERO_PICKS } from '../src/core/hero';
import { t, type StringKey } from '../src/i18n';
import type { Creature, Stage } from '../src/core/types';
import type { WebEngine } from './engine';
import type { Skia2 } from './skiaBoot';

const GAP = 14, HIT_MS = 1000;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const img = (src: string, css: string, alt = '') => `<img src="home/${src}.png" alt="${alt}" draggable="false" style="${css}">`;

export function initHome(o: {
  splash: HTMLElement; canvas: HTMLCanvasElement; engine: WebEngine; stages: Stage[]; creatures: Creature[];
  skia: Promise<Skia2>; foundOf: (i: number) => number; onPick: (i: number) => void; onHelp: () => void; onSongs: () => void;
}): { refresh: () => void } {
  const { splash, canvas, engine, stages } = o;
  let sk2: Skia2 | null = null, surface: any = null, raw: any = null, bg: any = null, bgKey = '';
  let hits: HeroHit[] = [];
  let W = 0, H = 0, dpr = 1;
  let geo = heroGeometry(844, 390, 90, 0, 0), padded = paddedGeo(geo, 300);
  const creatures = HERO_PICKS.map((i) => o.creatures[i]!);
  const bgCv = document.getElementById('homeBg') as HTMLCanvasElement, decor = document.getElementById('homeDecor') as HTMLElement;
  const ui = document.createElement('div');
  ui.id = 'homeUi';
  splash.appendChild(ui);
  let bgSurface: any = null;
  let firstVisit = true;

  const build = () => {
    const cardsTop = geo.top + geo.height + 2;
    const availW = W - 32;
    const fitW = (availW - GAP * (stages.length - 1)) / stages.length;
    const cardW = Math.min(Math.max(fitW, 110), W >= 900 && H >= 640 ? 250 : 220); // a tablet: bigger cards
    const cardH = Math.max(52, Math.min(H - cardsTop - 8 - 50, cardW * 0.92));
    const spare = H - cardsTop - (cardH + 46); // room left under the cards: a tablet puts them lower, so the screen is not empty at the bottom
    const cardsY = cardsTop + Math.max(0, Math.min(spare * 0.5, H * 0.12));
    const artW = Math.min(cardW, cardH * 0.99), artH = artW * 0.99;
    const fits = stages.length * cardW + (stages.length - 1) * GAP <= availW;
    const logoH = 92, logoW = logoH * (560 / 195);
    const lk = Math.min(44, cardH * 0.42);
    const dec = (n: string, x: number, y: number, w: number, h: number, op = 1) => img(n, `position:absolute;left:${W * x}px;top:${H * y}px;width:${w}px;height:${h}px;opacity:${op};pointer-events:none`);
    const btn = (id: string, art: string, label: string, cap: string, side: string) =>
      `<button class="hb" id="${id}" aria-label="${label}" style="${side}"><img src="home/${art}.png" alt="" draggable="false" width="60" height="60">${id === 'hbHelp' ? '<i class="hdot"></i>' : ''}<span>${cap}</span></button>`;
    decor.innerHTML =
      dec('planet-ring', 0.8, 0.2, 78, 45, 0.9) + dec('planet-b', 0.07, 0.3, 34, 33, 0.85) + dec('planet-c', 0.66, 0.07, 22, 21, 0.8) + dec('comet', 0.28, 0.04, 64, 36, 0.85) +
      dec('cloud-a', 0.04, 0.43, 84, 44, 0.45) + dec('cloud-b', 0.78, 0.42, 100, 45, 0.45) + dec('star-b', 0.2, 0.13, 20, 19) + dec('star-c', 0.9, 0.08, 18, 17) + dec('star-a', 0.58, 0.25, 14, 13);
    ui.innerHTML =
      `<div id="hlogo" role="img" aria-label="${t('app.name')}" style="left:${(W - logoW) / 2}px;top:6px;width:${logoW}px;height:${logoH}px">${img('logo', `width:${logoW}px;height:${logoH}px`)}<div class="rib" style="left:${logoW * 0.17}px;right:${logoW * 0.17}px;top:${logoH * 0.69}px;height:${logoH * 0.17}px"><span>${t('app.subtitle')}</span></div></div>` +
      btn('hbSongs', 'btn-note', t('a11y.songs'), t('ui.songs'), 'left:10px;top:6px') + btn('hbHelp', 'btn-help', t('a11y.help'), t('ui.help'), 'right:10px;top:6px') +
      `<div id="hcards" style="top:${cardsY}px;justify-content:${fits ? 'center' : 'flex-start'};gap:${GAP}px">` +
      stages.map((st, i) => {
        const found = o.foundOf(i), total = st.combos.length;
        const hint = firstVisit && i === 0;
        return `<button class="hc" data-i="${i}" aria-label="${t(st.nameKey as StringKey)}. ${t('select.found', { n: found, m: total })}" style="width:${cardW}px;animation-delay:${120 + i * 90}ms">` +
          `<span class="art" style="width:${artW}px;height:${artH}px">${hint ? `<i class="ring" style="width:${artW + 12}px;height:${artH + 12}px"></i>` : ''}` +
          img(`card${CARD_BY_STAGE_INDEX[i]! + 1}`, `width:${artW}px;height:${artH}px`) +
          `<span class="pill" style="top:${artH * 0.795}px;height:${artH * 0.15}px;left:${artW * 0.12}px;right:${artW * 0.12}px;font-size:${Math.min(16, artW * 0.1)}px"><b>${t(st.nameKey as StringKey)}</b></span>` +
          (i > 0 ? `<span class="cnt" style="left:${artW * 0.79 - lk * 0.43}px;top:${artH * 0.6 - lk * 0.43}px;width:${lk * 0.85}px;height:${lk * 0.85}px"><svg viewBox="0 0 24 24" width="${lk * 0.5}" height="${lk * 0.5}"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="#FFC857"/></svg></span>` : '') +
          (hint ? `<i class="finger" style="top:${artH * 0.42}px"></i>` : '') + `</span>` +
          `<span class="dots">${st.combos.map((_, k) => `<i class="${k < found ? 'on' : ''}"></i>`).join('')}</span></button>`;
      }).join('') + `</div>`;
    ui.querySelectorAll<HTMLButtonElement>('.hc').forEach((b) => b.addEventListener('click', () => { firstVisit = false; o.onPick(Number(b.dataset.i)); }));
    ui.querySelectorAll<HTMLElement>('.pill b').forEach((b) => { let fs = parseFloat(getComputedStyle(b).fontSize); const min = fs * 0.6; while (b.scrollWidth > b.clientWidth && fs > min) { fs -= 0.5; b.style.fontSize = `${fs}px`; } });
    ui.querySelector('#hbHelp')!.addEventListener('click', () => o.onHelp());
    ui.querySelector('#hbSongs')!.addEventListener('click', () => o.onSongs());
  };

  const layout = () => {
    const r = splash.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    bgCv.width = canvas.width; bgCv.height = canvas.height; bgCv.style.width = `${W}px`; bgCv.style.height = `${H}px`;
    try { surface?.delete?.(); bgSurface?.delete?.(); } catch { /* gone */ }
    surface = null; raw = null; bgSurface = null; bgKey = '';
    if (sk2) { surface = sk2.ck.MakeWebGLCanvasSurface(canvas) ?? sk2.ck.MakeSWCanvasSurface(canvas); raw = surface?.getCanvas() ?? null; bgSurface = sk2.ck.MakeSWCanvasSurface(bgCv); }
    geo = heroGeometry(W, H, 6 + 84, 0, 0);
    padded = paddedGeo(geo, H - geo.top);
    build();
  };

  // the singers: touch one (or slide over several) and it hops and sings its note
  let last = -1;
  const sing = (e: PointerEvent) => {
    const r = splash.getBoundingClientRect();
    const i = heroHitTest(geo, e.clientX - r.left, e.clientY - r.top - geo.top);
    if (i < 0) { last = -1; return; }
    if (i === last) return;
    last = i;
    void engine.ctx?.resume(); // the first touch unlocks the sound
    const now = performance.now();
    hits = [...hits.filter((h) => now - h.t < HIT_MS + 100), { i, t: now }];
    engine.playSfx('pop', HERO_NOTES[i]!);
  };
  splash.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement).closest('button')) return; sing(e); });
  splash.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') sing(e); });
  splash.addEventListener('pointerup', () => { last = -1; });
  splash.addEventListener('pointercancel', () => { last = -1; });

  const draw = (now: number) => {
    requestAnimationFrame(draw);
    if (splash.classList.contains('hide') || !sk2 || !raw) return;
    const { sk } = sk2;
    hits = hits.filter((h) => now - h.t < HIT_MS + 100);
    const key = `${W}x${H}`;
    if (bgKey !== key) {
      const rec = sk.PictureRecorder();
      drawHomeBackdrop(sk, rec.beginRecording({ x: 0, y: 0, width: W, height: H }), W, H);
      bg = rec.finishRecordingAsPicture(); bgKey = key;
      const bc = bgSurface?.getCanvas();
      if (bc) { bc.save(); bc.scale(dpr, dpr); bc.drawPicture(bg.ref ?? bg); bc.restore(); bgSurface.flush(); }
    }
    const rec = sk.PictureRecorder();
    const c = rec.beginRecording({ x: 0, y: 0, width: W, height: H });
    c.save();
    c.translate(0, geo.top - padded.pad);
    drawHero(sk, c, creatures, padded.geo, W, now, hits, -1, 300, still);
    c.restore();
    const pic = rec.finishRecordingAsPicture();
    raw.clear(sk2.ck.Color4f(0, 0, 0, 0));
    raw.save(); raw.scale(dpr, dpr); raw.drawPicture((pic as any).ref ?? pic); raw.restore();
    surface.flush();
    try { (pic as any).dispose?.(); } catch { /* ok */ }
  };

  layout();
  addEventListener('resize', layout);
  void o.skia.then((s) => { sk2 = s; layout(); });
  requestAnimationFrame(draw);
  return { refresh: build };
}
