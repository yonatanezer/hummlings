// Builds the playable web demo (artifact): sprite atlases rendered by the real draw code, mp3 loops, one bundled script, one page.
// Run: npx tsx scripts/build-web.ts  -> scripts/out/webdemo/
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { IDLE_POSE, drawCreature } from '../src/ui/draw/creature';
import { loadStages } from './qa-lib';
import { renderPng } from './render-lib';

const OUT = 'scripts/out/webdemo';
const CELL_W = 220, CELL_H = 240, FEET_X = 110, FEET_Y = 222, S = 120;

async function main() {
  mkdirSync(`${OUT}/sprites`, { recursive: true });
  mkdirSync(`${OUT}/audio`, { recursive: true });
  for (const st of loadStages()) {
    const png = await renderPng(CELL_W * 4, CELL_H * st.creatures.length, (sk, c) => {
      st.creatures.forEach((cr, i) => {
        const poses = [{ ...IDLE_POSE }, { ...IDLE_POSE, mouth: 0.85 }, { ...IDLE_POSE, eyes: 0 }, { ...IDLE_POSE, muted: true, alpha: 2.5 }];
        poses.forEach((p, k) => drawCreature(sk, c, cr, k * CELL_W + FEET_X, i * CELL_H + FEET_Y, S, p));
      });
    }, 1);
    writeFileSync(`${OUT}/sprites/${st.id}.png`, png);
    for (const f of [...st.creatures.map((c) => c.loopFile), ...st.combos.map((c) => c.bonusLoopFile)]) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `assets/loops/${f}`, '-b:a', '96k', `${OUT}/audio/${f.replace('.m4a', '.mp3')}`]);
    }
    console.log('built', st.id);
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'assets/sfx/tick.m4a', '-b:a', '96k', `${OUT}/audio/tick.mp3`]);
  await build({ entryPoints: ['web/main.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: `${OUT}/game.js`, loader: { '.json': 'json' }, logLevel: 'warning' });
  writeFileSync(`${OUT}/index.html`, `<title>Hummlings Playground</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: the game fills the viewport (landscape feel); a slim top bar floats over the stage. Single dark look by design (night stage). */
:root{--bg:#1B1340;--fg:#FFFFFF;--dim:#C9C2F0;--panel:#241A52;--accent:#FFC857;color-scheme:dark}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,sans-serif;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
#wrap{position:fixed;inset:0;display:flex;flex-direction:column}
#game{flex:1;width:100%;min-height:0;display:block;touch-action:none}
#bar{position:fixed;top:0;left:0;right:0;display:flex;gap:8px;align-items:center;flex-wrap:nowrap;padding:8px max(12px,env(safe-area-inset-right,0px)) 8px max(12px,env(safe-area-inset-left,0px));pointer-events:none}
#bar>*{pointer-events:auto}
#worlds{display:flex;gap:6px;flex-wrap:nowrap}
button{font:inherit;color:var(--fg);background:rgba(27,19,64,.78);border:1.5px solid rgba(255,255,255,.2);border-radius:20px;min-height:44px;padding:0 16px;cursor:pointer}
button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
button.on{background:#7A8CFF;border-color:#fff}
#combos-wrap{display:flex;align-items:center;gap:10px;margin-left:auto;padding:6px 12px;border-radius:20px;background:rgba(27,19,64,.78)}
#combos-wrap .lbl{font-size:12px;color:var(--dim);letter-spacing:.04em;text-transform:uppercase}#combos{display:flex;gap:10px}
#worlds button{white-space:nowrap;display:inline-flex;align-items:center;gap:8px}#worlds .short{display:none}@media (max-width:980px){#worlds .long{display:none}#worlds .short{display:inline}}
.wd{width:12px;height:12px;border-radius:50%;display:block}
#beat{width:10px;height:10px;border-radius:50%;background:#FF7AA8;display:block}
button.ic{width:44px;padding:0;display:grid;place-items:center}
svg{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}svg .fill{fill:currentColor;stroke:none}
button.ic svg{width:24px;height:24px}button.ic .off{display:none}button.ic.off .on{display:none}button.ic.off .off{display:block}button.ic.off{background:#FF4D6D}
#rotate{position:fixed;inset:0;z-index:9;background:#150F33;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--fg)}#rotate svg{stroke:var(--accent)}
@media (max-width:980px){#combos-wrap .lbl{display:none}button{padding:0 12px;font-size:14px}}
@media (max-width:640px){#combos-wrap .lbl{display:none}#bar{gap:6px}button{padding:0 10px;min-height:40px;font-size:13px}}
.combo{display:flex;gap:4px}.combo i{width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.18);display:block}.combo i.lit{background:var(--accent)}.combo.found{outline:2px solid var(--accent);outline-offset:3px;border-radius:8px}
#tip{position:fixed;left:50%;bottom:6px;font-size:14px;line-height:1.25;white-space:nowrap;transform:translateX(-50%);background:rgba(27,19,64,.82);padding:6px 14px;border-radius:16px;text-align:center;transition:opacity .4s;max-width:94vw;overflow:hidden;text-overflow:ellipsis}
.hide{opacity:0;pointer-events:none;visibility:hidden}
#splash,#loading{position:fixed;inset:0;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;background:rgba(21,15,51,.94);text-align:center;padding:24px;z-index:5}
#loading{background:rgba(21,15,51,.7);z-index:4}
#splash h1{margin:0;font-size:40px}#splash p{max-width:46ch;color:var(--dim);margin:0}
#start{background:#5FE3C0;color:#10282A;font-size:20px;font-weight:700;min-height:56px;padding:0 32px;border-radius:28px}
#toast{position:fixed;top:22%;left:50%;transform:translate(-50%,-10px);background:var(--accent);color:#2A1F00;font-weight:700;padding:10px 20px;border-radius:22px;opacity:0;transition:all .4s}#toast.show{opacity:1;transform:translate(-50%,0)}
</style>
<div id="wrap"><canvas id="game" aria-label="Hummlings stage"></canvas></div>
<div id="bar"><div id="worlds" role="group" aria-label="Worlds"></div>
<button id="clear" class="ic" aria-label="Clear the stage" title="Clear the stage"><svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg></button>
<button id="mute" class="ic" aria-label="Pause the music" title="Pause / resume" aria-pressed="false"><svg class="on" viewBox="0 0 24 24"><path d="M5 9v6h4l5 4V5L9 9z" class="fill"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/></svg><svg class="off" viewBox="0 0 24 24"><path d="M5 9v6h4l5 4V5L9 9z" class="fill"/><path d="M17 9l5 6M22 9l-5 6"/></svg></button>
<div id="combos-wrap"><span class="lbl">Secret combos</span><div id="combos" aria-label="Secret combos: a dot lights up for each matching singer on stage"></div></div><i id="beat" aria-hidden="true"></i></div>
<div id="tip">Drag a singer up onto the stage. Tap it to mute, hold to solo, drag it off to remove. Find the secret combos!</div>
<div id="toast">Secret combo found!</div>
<div id="rotate" class="hide"><svg viewBox="0 0 24 24" width="64" height="64"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M3 12h2M19 12h2"/></svg><p>Turn your phone sideways to play.</p></div>
<div id="loading" class="hide"><p>Loading music…</p></div>
<div id="splash"><h1>Hummlings</h1><p>A playable preview: the real music loops and the real game logic, drawn in your browser. Sound starts after you press play.</p><button id="start">Play</button></div>
<script src="game.js"></script>`);
  console.log('web demo ready');
}
void main();
