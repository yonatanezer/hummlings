// Builds the playable web demo (artifact): sprite atlases rendered by the real draw code, mp3 loops, one bundled script, one page.
// Run: npx tsx scripts/build-web.ts  -> scripts/out/webdemo/
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { IDLE_POSE, drawCreature } from '../src/ui/draw/creature';
import { drawHelpStep } from '../src/ui/draw/help';
import { loadStages } from './qa-lib';
import { renderPng } from './render-lib';

const OUT = 'scripts/out/webdemo';
const CELL_W = 220, CELL_H = 240, FEET_X = 110, FEET_Y = 222, S = 120;

async function main() {
  mkdirSync(`${OUT}/sprites`, { recursive: true });
  mkdirSync(`${OUT}/audio`, { recursive: true });
  for (const st of loadStages()) {
    const png = await renderPng(CELL_W * 10, CELL_H * st.creatures.length, (sk, c) => {
      st.creatures.forEach((cr, i) => {
        // 9 poses = {rest, singing, blink} x ear/tail sway {-1, 0, +1}; the 10th is the muted pose
        const sway = [267, 0.001, -267]; // pose.time values for sin(time / 170) = +1, 0, -1
        const poses = [0, 1, 2].flatMap((state) => sway.map((time) => ({ ...IDLE_POSE, time, mouth: state === 1 ? 0.85 : 0, eyes: state === 2 ? 0 : 1 })));
        poses.push({ ...IDLE_POSE, muted: true, alpha: 2.5, time: 0.001 });
        poses.forEach((p, k) => drawCreature(sk, c, cr, k * CELL_W + FEET_X, i * CELL_H + FEET_Y, S, p));
      });
    }, 1);
    writeFileSync(`${OUT}/sprites/${st.id}.png`, png);
    for (const f of [...st.creatures.map((c) => c.loopFile), ...st.combos.map((c) => c.bonusLoopFile), st.ambienceFile]) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `assets/loops/${f}`, '-b:a', '96k', `${OUT}/audio/${f.replace('.m4a', '.mp3')}`]);
    }
    console.log('built', st.id);
  }
  mkdirSync(`${OUT}/help`, { recursive: true });
  const pondStage = loadStages()[0]!;
  for (let i = 0; i < 7; i++) writeFileSync(`${OUT}/help/${i + 1}.png`, await renderPng(560, 308, (sk, c) => drawHelpStep(sk, c, pondStage, i, [2000, 2000, 2000, 1800, 1500, 3000, 1000][i]!, 560, 308), 1.5));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'assets/sfx/tick.m4a', '-b:a', '96k', `${OUT}/audio/tick.mp3`]);
  for (const k of ['pop', 'pickup', 'mute', 'unmute', 'remove', 'goal', 'combo', 'snare']) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `assets/sfx/${k}.m4a`, '-b:a', '96k', `${OUT}/audio/sfx_${k}.mp3`]);
  await build({ entryPoints: ['web/main.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: `${OUT}/game.js`, loader: { '.json': 'json' }, logLevel: 'warning' });
  writeFileSync(`${OUT}/index.html`, `<title>Hummlings Playground</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: the game fills the viewport (landscape feel); a slim top bar floats over the stage. Single dark look by design (night stage). */
:root{--bg:#1B1340;--fg:#FFFFFF;--dim:#E2DCFF;--panel:#241A52;--accent:#FFC857;color-scheme:dark}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,sans-serif;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
#wrap{position:fixed;inset:0;display:flex;flex-direction:column}
#game{flex:1;width:100%;min-height:0;display:block;touch-action:none}
#bar{position:fixed;top:0;left:0;right:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap;row-gap:6px;padding:8px max(12px,env(safe-area-inset-right,0px)) 8px max(12px,env(safe-area-inset-left,0px));pointer-events:none}
#bar>*{pointer-events:auto}
#worlds{display:flex;gap:6px;flex-wrap:nowrap;flex:none}
button{font:inherit;font-weight:600;color:var(--fg);background:rgba(27,19,64,.94);border:2px solid rgba(255,255,255,.4);border-radius:26px;min-height:52px;padding:0 18px;cursor:pointer;transition:transform .08s,background .15s}
button:hover{background:#33276E}button:active{transform:scale(.94)}
button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
button.on{background:#7A8CFF;border-color:#fff}
#combos-wrap{display:flex;align-items:center;gap:10px;padding:6px 12px;border-radius:20px;background:rgba(27,19,64,.78)}
#combos-wrap .lbl{font-size:13px;font-weight:700;color:var(--dim);letter-spacing:.04em;text-transform:uppercase}#combos{display:flex;gap:10px}
#worlds button{white-space:nowrap;display:inline-flex;align-items:center;gap:8px}#worlds .short{display:none}@media (max-width:980px){#worlds .long{display:none}#worlds .short{display:inline}}
.wi{display:inline-flex}.wi svg{display:block}.wd{width:12px;height:12px;border-radius:50%;display:block}
#cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:12px}.card{background:rgba(255,255,255,.06);border-radius:16px;padding:8px;display:flex;flex-direction:column;align-items:center;gap:8px}.card canvas{width:100%;height:auto;border-radius:10px}
.ov{position:fixed;inset:0;z-index:7;background:rgba(10,6,32,.78);display:flex;align-items:center;justify-content:center;padding:12px}.sheet{position:relative;background:var(--panel);border-radius:24px;padding:20px;max-width:760px;width:100%;max-height:92vh;overflow:auto;text-align:center}.sheet h2{margin:0 0 6px;font-size:22px}.sheet .sub{margin:0 auto 12px;color:var(--dim);max-width:52ch}.sheet img{max-width:100%;max-height:50vh;width:auto;height:auto;border-radius:14px;border:2px solid #FFE8A366}.sheet .x{position:absolute;top:8px;right:8px}.nav{display:flex;align-items:center;justify-content:center;gap:16px}#hDots{display:flex;gap:8px}#hDots i{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.25)}#hDots i.on{background:var(--accent);width:24px;border-radius:5px}
.rip{position:fixed}
#band{display:flex;gap:5px;margin-left:auto;flex:none;padding:8px 10px;border-radius:20px;background:rgba(27,19,64,.78)}#band{gap:8px!important;padding:6px 10px!important}#band b{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;font-weight:700;color:#cfc8f5;letter-spacing:.03em}#band b i{width:30px;height:30px;border-radius:10px;background:rgba(255,255,255,.12);display:grid;place-items:center;transition:all .2s;color:#8f86c8}#band b i svg{width:20px;height:20px}#band b.on{color:#fff}#band b.on i{background:var(--c);color:#1B1340;box-shadow:0 0 12px var(--c)}
#combos-wrap{margin-left:0!important;flex:none}
.goals{grid-column:1/-1;text-align:left;margin-top:6px}.goals h3{margin:6px 0;font-size:16px}.goal{display:grid;gap:2px;background:rgba(255,255,255,.06);border-radius:12px;padding:8px 12px;margin-bottom:6px;position:relative;overflow:hidden}.goal span{color:var(--dim);font-size:13px}.goal em{display:block;height:4px;border-radius:2px;background:rgba(255,255,255,.12);position:relative}.goal em::after{content:"";position:absolute;inset:0;width:var(--p);background:var(--accent);border-radius:2px}.goal.done{outline:1.5px solid var(--accent)}
#combos small{font-size:13px;font-weight:700;color:var(--dim);align-self:center}
#beat{width:10px;height:10px;border-radius:50%;background:#FF7AA8;display:block}
button{flex:none}
button.ic{min-width:52px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:8px}
button.lb span{font-size:15px}
@keyframes pul{0%,100%{box-shadow:0 0 0 0 rgba(255,224,102,.7)}50%{box-shadow:0 0 0 10px rgba(255,224,102,0)}}button.pulse{animation:pul 1.6s infinite;border-color:#FFE066}
svg{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}svg .fill{fill:currentColor;stroke:none}
button.ic svg{width:26px;height:26px;flex:none}button.ic .off{display:none}button.ic.off .on{display:none}button.ic.off .off{display:block}button.ic.off{background:#FF4D6D}
#rotate{position:fixed;inset:0;z-index:9;background:#150F33;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--fg)}#rotate svg{stroke:var(--accent)}
@media (max-width:980px){#combos-wrap .lbl{display:none}button{padding:0 12px;font-size:14px}button.lb span{display:none}}
@media (max-width:640px){#combos-wrap .lbl{display:none}#bar{gap:6px}button{padding:0 10px;min-height:40px;font-size:13px}}
.combo{display:flex;gap:4px}.combo i{width:17px;height:17px;border-radius:50%;background:rgba(255,255,255,.18);display:block}.combo i.lit{background:var(--accent)}.combo.found{outline:2px solid var(--accent);outline-offset:3px;border-radius:8px}
#tip{position:fixed;left:50%;bottom:8px;font-size:16px;font-weight:700;line-height:1.25;white-space:nowrap;transform:translateX(-50%);background:#FFE8A3;color:#2A1F00;padding:9px 18px;border-radius:20px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.4);transition:opacity .4s;max-width:94vw;overflow:hidden;text-overflow:ellipsis}
.hide{opacity:0;pointer-events:none;visibility:hidden}
#splash,#loading{position:fixed;inset:0;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;background:rgba(21,15,51,.94);text-align:center;padding:24px;z-index:5}
#loading{background:rgba(21,15,51,.7);z-index:4}
#splash h1{margin:0;font-size:40px}#splash p{max-width:46ch;color:var(--dim);margin:0}
#start{background:#5FE3C0;color:#10282A;font-size:20px;font-weight:700;min-height:56px;padding:0 32px;border-radius:28px}
#toast{position:fixed;top:22%;left:50%;transform:translate(-50%,-10px);background:var(--accent);color:#2A1F00;font-weight:700;padding:10px 20px;border-radius:22px;opacity:0;transition:all .4s}#toast.show{opacity:1;transform:translate(-50%,0)}
</style>
<div id="wrap"><canvas id="game" aria-label="Hummlings stage"></canvas></div>
<div id="bar"><div id="worlds" role="group" aria-label="Worlds"></div>
<button id="clear" class="ic lb" aria-label="Clear the stage" title="Clear the stage"><svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg><span>Clear</span></button>
<button id="mute" class="ic lb" aria-label="Pause the music" title="Pause / resume" aria-pressed="false"><svg class="on" viewBox="0 0 24 24"><path d="M5 9v6h4l5 4V5L9 9z" class="fill"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/></svg><svg class="off" viewBox="0 0 24 24"><path d="M5 9v6h4l5 4V5L9 9z" class="fill"/><path d="M17 9l5 6M22 9l-5 6"/></svg><span>Sound</span></button>
<button id="bookBtn" class="ic lb" aria-label="Combo book" title="Combo book"><svg viewBox="0 0 24 24"><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM8 4v13"/></svg><span>Combos</span></button>
<button id="helpBtn" class="ic lb pulse" aria-label="How to play" title="How to play"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17.2v.3"/></svg><span>Help</span></button>
<div id="band" aria-label="Band: layers playing"></div>
<div id="combos-wrap"><span class="lbl">Combo hint</span><div id="combos" aria-label="Secret combos: a dot lights up for each matching singer on stage"></div></div><i id="beat" aria-hidden="true"></i></div>
<div id="tip">Drag a singer up onto the stage. Tap it to mute, hold to solo, drag it off to remove. Find the secret combos!</div>
<div id="toast">Secret combo found!</div>
<div id="book" class="ov hide" role="dialog" aria-label="Combo book"><div class="sheet"><button class="ic x" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button><h2>Secret combos</h2><p class="sub">Dots light up for each matching singer on stage. Put all four together and keep them for two loops.</p><div id="cards"></div></div></div>
<div id="help" class="ov hide" role="dialog" aria-label="How to play"><div class="sheet"><button class="ic x" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button><h2>How to play</h2><img id="helpImg" alt="" width="560" height="308"><p id="helpTxt"></p><div class="nav"><button id="hPrev" class="ic" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><span id="hDots"></span><button id="hNext" class="ic" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div></div></div>
<div id="rotate" class="hide"><svg viewBox="0 0 24 24" width="64" height="64"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M3 12h2M19 12h2"/></svg><p>Turn your phone sideways to play.</p></div>
<div id="loading" class="hide"><p>Loading music…</p></div>
<div id="splash"><h1>Hummlings</h1><p>A playable preview: the real music loops and the real game logic, drawn in your browser. Sound starts after you press play.</p><button id="start">Play</button></div>
<script src="game.js"></script>`);
  console.log('web demo ready');
}
void main();
