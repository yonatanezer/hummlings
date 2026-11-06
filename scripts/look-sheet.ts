// Builds the M1 look-and-sound sheet: headless-rendered screenshots (same draw code as the app) + audio previews.
// Run: npx tsx scripts/look-sheet.ts  -> scripts/out/looksheet/index.html (+ png/m4a files)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { computeLayout } from '../src/core/layout';
import { renderSong, samplesPerBar } from '../src/core/render';
import type { Song } from '../src/core/timeline';
import { TUNING } from '../src/core/tuning';
import { encodeWav } from '../src/core/wav';
import { decodeLoop, loadStages } from './qa-lib';
import { renderPng } from './render-lib';
import { renderClip } from './anim-clip';
import { drawComboCard } from '../src/ui/draw/comboCard';
import { IDLE_POSE, drawCreature } from '../src/ui/draw/creature';
import { drawSplash } from '../src/ui/draw/logo';
import { drawScene, type SceneInput } from '../src/ui/draw/scene';
import { drawStageCard } from '../src/ui/draw/stageCard';
import { gradientPaint } from '../src/ui/draw/common';
import type { Stage } from '../src/core/types';

const OUT = 'scripts/out/looksheet';
mkdirSync(OUT, { recursive: true });
const stages = loadStages();
const shots: { file: string; title: string; note?: string }[] = [];
const save = (file: string, buf: Buffer, title: string, note?: string) => { writeFileSync(`${OUT}/${file}`, buf); shots.push({ file, title, note }); };

function scene(stage: Stage, W: number, H: number, over: Partial<SceneInput> = {}, picks = [0, 5, 10, 14, 3, 8]): SceneInput {
  const layout = computeLayout(W, H, undefined, 40);
  const ids = picks.map((i) => stage.creatures[i]!.id);
  return {
    layout, stage, placed: ids.map((id, spot) => ({ id, spot, since: -5000, from: layout.slotPos[0]! })), muted: {}, solo: null, drags: [], returning: [],
    scrollX: 0, beat: 8.1, timeMs: 3000, reduceMotion: false, celebration: null, hint: false, recordingBeat: null, hintSlot: 0, ...over,
  };
}

async function main() {
  const pond = stages[0]!;
  // 1. all 48 creatures, one image per stage
  for (const st of stages) {
    const png = await renderPng(1000, 640, (sk, c) => {
      c.drawRect(sk.XYWHRect(0, 0, 1000, 640), gradientPaint(sk, 0, 0, 0, 640, [st.palette.sky, st.palette.floor]));
      st.creatures.forEach((cr, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        drawCreature(sk, c, cr, 140 + col * 240, 170 + row * 150, 120, { ...IDLE_POSE, mouth: (i % 3) * 0.35 });
      });
    }, 1.5);
    save(`creatures_${st.id}.png`, png, `Creatures: ${st.id}`, 'Rows = layers (drums round, bass wide, melody tall, voice small); 4 variants each.');
  }
  // 2. stage states (stage 1, 844x390 and others)
  const states: [string, string, Partial<SceneInput>, string?][] = [
    ['stage_full', 'Stage: 6 creatures, one muted', {}, 'Muted = eyes closed, desaturated, 40% opacity.'],
    ['stage_solo', 'Solo (long-press)', {}, 'Everyone else dims to 30%, spotlight on the soloist.'],
    ['stage_celebration', 'Combo celebration', {}, 'Lights, bubbles, creatures dance. 8 bars, then back to normal.'],
    ['stage_empty_hint', 'First run: empty stage, animated hand', {}, 'No text. Repeats every 4 s until the first drop.'],
    ['stage_drag', 'Dragging a creature from the tray', {}, 'Carried creature is lifted and slightly tilted; its tray slot shows a faded silhouette.'],
  ];
  for (const [file, title, , note] of states) {
    const s = scene(pond, 844, 390);
    if (file === 'stage_full') s.muted = { [s.placed[1]!.id]: true };
    if (file === 'stage_solo') s.solo = s.placed[2]!.id;
    if (file === 'stage_celebration') s.celebration = { celebrationId: 'cel_pond_1', creatureIds: s.placed.slice(0, 4).map((p) => p.id), startBeat: 2 };
    if (file === 'stage_empty_hint') { s.placed = []; s.hint = true; s.timeMs = 1900; }
    if (file === 'stage_drag') { s.placed = s.placed.slice(0, 3); s.drags = [{ id: pond.creatures[9]!.id, x: 520, y: 150 }]; }
    save(`${file}.png`, await renderPng(844, 390, (sk, c) => drawScene(sk, c, s), 2), title, note);
  }
  for (const st of stages.slice(1)) {
    const s = scene(st, 844, 390, {}, [1, 4, 9, 13, 2, 15]);
    s.celebration = { celebrationId: st.combos[1]!.celebrationId, creatureIds: s.placed.slice(0, 4).map((p) => p.id), startBeat: 2 };
    save(`stage_${st.id}.png`, await renderPng(844, 390, (sk, c) => drawScene(sk, c, s), 2), `World: ${st.id} (with celebration)`);
  }
  // 3. sizes
  for (const [W, H, name] of [[667, 375, 'iPhone SE'], [1180, 820, 'iPad']] as const) {
    const s = scene(pond, W, H);
    save(`size_${W}.png`, await renderPng(W, H, (sk, c) => drawScene(sk, c, s), W > 900 ? 1 : 2), `Layout on ${name} (${W}x${H})`, name === 'iPad' ? 'Large tray; scrolls a little (24 creatures).' : 'Tray scrolls horizontally; every target >= 56 pt.');
  }
  // 4. stage select, splash, combo book
  const selW = 844, selH = 390;
  save('stage_select.png', await renderPng(selW, selH, (sk, c) => {
    c.drawRect(sk.XYWHRect(0, 0, selW, selH), gradientPaint(sk, 0, 0, 0, selH, ['#0B0722', '#1B1340']));
    stages.forEach((st, i) => { c.save(); c.translate(40 + i * 265, 60); drawStageCard(sk, c, st, 240, 270, i > 0); c.restore(); });
  }, 2), 'Stage select (world 2 and 3 locked until unlock)', 'World names and padlock badges are text/icons added by the app.');
  save('splash.png', await renderPng(844, 390, (sk, c) => drawSplash(sk, c, pond.creatures.filter((_, i) => i % 2 === 0), 844, 390, 1100), 2), 'Splash (wordmark added by the app)');
  save('combo_book.png', await renderPng(844, 260, (sk, c) => {
    c.drawRect(sk.XYWHRect(0, 0, 844, 260), gradientPaint(sk, 0, 0, 0, 260, ['#241A52', '#241A52']));
    pond.combos.forEach((cb, i) => { c.save(); c.translate(24 + i * 270, 20); drawComboCard(sk, c, pond, cb, 250, 190, i === 0); c.restore(); });
  }, 2), 'Combo book: one discovered, two secret', 'Four dots (app UI) light up for creatures on stage: an honest hint.');

  // 4b. animated clips: creatures hop in one by one, bounce on the beat, mouths follow the notes, ears sway; then a celebration
  mkdirSync(`${OUT}/video`, { recursive: true });
  await renderClip(pond, `${OUT}/video/stage.mp4`, { seconds: 12, picks: [0, 5, 10, 14, 3, 8], celebrationAtBeat: 12 });
  await renderClip(stages[1]!, `${OUT}/video/fair.mp4`, { seconds: 8, picks: [1, 4, 9, 13, 2, 15] });
  await renderClip(stages[2]!, `${OUT}/video/clouds.mp4`, { seconds: 8, picks: [2, 6, 8, 12, 5, 11], celebrationAtBeat: 8 });
  // 5. audio: every stage-1 loop + one full mix
  mkdirSync(`${OUT}/audio`, { recursive: true });
  const audio: { file: string; title: string }[] = [];
  for (const cr of pond.creatures) { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `assets/loops/${cr.loopFile}`, '-b:a', '96k', `${OUT}/audio/${cr.loopFile.replace('.m4a', '.mp3')}`]); audio.push({ file: `audio/${cr.loopFile.replace('.m4a', '.mp3')}`, title: `${cr.layer} ${cr.id.slice(-1)}` }); }
  const bank: Record<string, Float32Array> = {};
  for (const c of pond.creatures) bank[c.loopFile] = decodeLoop(c.loopFile);
  for (const c of pond.combos) bank[c.bonusLoopFile] = decodeLoop(c.bonusLoopFile);
  const ids = [0, 4, 8, 12, 1, 9, 13, 5].map((i) => pond.creatures[i]!.id);
  const ev: Song['events'] = [];
  ids.forEach((id, i) => ev.push({ bar: i * 2, action: { kind: 'drop', creatureId: id, spot: i % 6 } }));
  ev.push({ bar: 20, action: { kind: 'mute', creatureId: ids[0]! } }, { bar: 22, action: { kind: 'mute', creatureId: ids[0]! } });
  const song: Song = { id: 'demo', name: 'demo', stageId: 'pond', createdAt: 0, bars: 28, events: ev };
  const mix = renderSong(pond, song, bank);
  writeFileSync(`${OUT}/mix.wav`, encodeWav(mix.samples, TUNING.sampleRate));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${OUT}/mix.wav`, '-b:a', '128k', `${OUT}/audio/full_mix.mp3`]);
  console.log('mix peak', mix.peakDb.toFixed(2), 'reduction', mix.maxGainReductionDb.toFixed(2), 'bars', samplesPerBar(pond.bpm));

  const html = `<title>Hummlings Look Sheet</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: one column of figures that wraps into a grid; art stays on its own dark night-stage ground in both themes. */
:root{--bg:#F5F3FF;--panel:#FFFFFF;--text:#1B1340;--dim:#5A5290;--line:#DCD7F5}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#150F33;--panel:#241A52;--text:#FFFFFF;--dim:#C9C2F0;--line:#3A2E7A;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#150F33;--panel:#241A52;--text:#FFFFFF;--dim:#C9C2F0;--line:#3A2E7A;color-scheme:dark}
body{background:var(--bg);color:var(--text);font:16px/1.5 system-ui,sans-serif;padding-block:16px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{margin:0 0 4px;font-size:28px;text-wrap:balance}h2{margin:32px 0 8px;font-size:20px}p{color:var(--dim);margin:4px 0;max-width:65ch}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px}
figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:10px;min-width:0}video,img{width:100%;height:auto;border-radius:10px;display:block}figcaption{padding:8px 4px 0}
.a{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:8px}.a div{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:8px;min-width:0}audio{width:100%}
.sw{display:flex;gap:8px;flex-wrap:wrap}.sw span{padding:8px 12px;border-radius:10px;color:#111;font-weight:600}
</style>
<h1>Hummlings look and sound sheet</h1><p>Rendered headlessly with the same drawing code the app uses. Waiting for your approval of the art direction.</p>
<div class="sw"><span style="background:#FF7AA8">drums #FF7AA8</span><span style="background:#7A8CFF">bass #7A8CFF</span><span style="background:#5FE3C0">melody #5FE3C0</span><span style="background:#FFC857">voice #FFC857</span></div>
<h2>Animation</h2><p>Hop on every note, squash and stretch on the beat, mouths follow the notes, ears, tails and gills sway, eyes glance around, then a celebration.</p><div class="g"><figure><video controls loop muted autoplay playsinline src="video/stage.mp4"></video><figcaption><b>Moonlit Pond: build-up and celebration</b></figcaption></figure><figure><video controls loop muted autoplay playsinline src="video/fair.mp4"></video><figcaption><b>Candy Fair</b></figcaption></figure><figure><video controls loop muted autoplay playsinline src="video/clouds.mp4"></video><figcaption><b>Sleepy Cloud Town with celebration</b></figcaption></figure></div>
<h2>Sound</h2><p>One full mix of the pond (28 bars, a layer joins every 2 bars, then mute and unmute) and every stage 1 loop (4 bars each). Press play on each.</p>
<div class="a"><div><b>Full mix</b><audio controls preload="none" src="audio/full_mix.mp3"></audio></div>${audio.map((a) => `<div>${a.title}<audio controls preload="none" src="${a.file}"></audio></div>`).join('')}</div>
<h2>Screens and states</h2><div class="g">${shots.map((s) => `<figure><img loading="lazy" src="${s.file}" alt="${s.title}"><figcaption><b>${s.title}</b>${s.note ? `<br><span style="color:var(--dim)">${s.note}</span>` : ''}</figcaption></figure>`).join('')}</div>`;
  writeFileSync(`${OUT}/index.html`, html);
  console.log('looksheet ready', shots.length, 'shots');
}
void main();
