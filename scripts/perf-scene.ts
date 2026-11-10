// Offline cost proxy for the scene (CanvasKit in Node, CPU recording only, no GPU): ms per frame for the whole scene vs the cached-backdrop path vs singers alone.
// Absolute numbers are NOT device numbers; use them to compare worlds and before/after a change.
import { computeLayout } from '../src/core/layout';
import { loadStages } from './qa-lib';
import { initSkia } from './render-lib';
import { drawBackdrop, drawScene, drawTray, type SceneInput } from '../src/ui/draw/scene';
import { drawDecor, drawScenery } from '../src/ui/draw/scenery';
import { IDLE_POSE, drawCreature } from '../src/ui/draw/creature';
import type { Stage } from '../src/core/types';

const W = 844, H = 390, FRAMES = 150;

function input(stage: Stage, t: number, backdrop?: SceneInput['backdrop'], trayPicture?: SceneInput['trayPicture']): SceneInput {
  const layout = computeLayout(W, H, undefined, 40);
  const ids = [1, 7, 15, 19, 4].map((i) => stage.creatures[i]!.id);
  return {
    layout, stage, placed: ids.map((id, spot) => ({ id, spot, since: -5000, from: layout.slotPos[0]! })), muted: {}, solo: null, drags: [], returning: [],
    scrollX: 0, beat: (t / 650) % 16, timeMs: t, reduceMotion: false, celebration: null, hint: false, recordingBeat: null, hintSlot: 0, backdrop, trayPicture,
  };
}

async function main() {
  const sk = await initSkia();
  const bounds = sk.XYWHRect(0, 0, W, H);
  const record = (fn: (c: ReturnType<ReturnType<typeof sk.PictureRecorder>['beginRecording']>) => void) => {
    const rec = sk.PictureRecorder();
    fn(rec.beginRecording(bounds));
    return rec.finishRecordingAsPicture();
  };
  const time = (fn: (t: number) => void): number => {
    for (let i = 0; i < 20; i++) fn(i * 16); // warm-up
    const t0 = performance.now();
    for (let i = 0; i < FRAMES; i++) fn(1000 + i * 16);
    return (performance.now() - t0) / FRAMES;
  };
  // like the app: the singer menu is a cached picture, so it is not part of the per-frame cost
  const trayOf = (st: Stage) => record((c) => drawTray(sk, c as never, input(st, 0)));
  console.log('world    full(ms)  cached-backdrop(ms)  backdrop-only(ms)');
  for (const st of loadStages()) {
    const tray = trayOf(st);
    const full = time((t) => { record((c) => drawScene(sk, c as never, input(st, t, undefined, tray))); });
    const pic = record((c) => drawBackdrop(sk, c as never, st, computeLayout(W, H, undefined, 40), 0));
    const cached = time((t) => { record((c) => drawScene(sk, c as never, input(st, t, pic, tray))); });
    const back = time((t) => { record((c) => drawBackdrop(sk, c as never, st, computeLayout(W, H, undefined, 40), Math.floor(t / 1800))); });
    const lay = computeLayout(W, H, undefined, 40);
    const live = time((t) => { record((c) => { drawScenery(sk, c as never, st.id, lay, st.palette, t, 'live'); drawDecor(sk, c as never, st.id, lay, st.palette, t, (t / 650) % 16); }); });
    const sing = time((t) => { record((c) => { for (let k = 0; k < 5; k++) drawCreature(sk, c as never, st.creatures[[1, 7, 15, 19, 4][k]!]!, lay.spots[k]!.x, lay.spots[k]!.y, lay.size, { ...IDLE_POSE, mouth: (t % 400) / 400 }); }); });
    console.log(`   parts: live scenery+decor ${live.toFixed(2)} ms, 5 singers ${sing.toFixed(2)} ms`);
    console.log(`${st.id.padEnd(8)} ${full.toFixed(2).padStart(8)} ${cached.toFixed(2).padStart(20)} ${back.toFixed(2).padStart(18)}`);
  }
}
void main();
