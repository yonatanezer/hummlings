// Renders short animated clips of the stage (same draw code as the app) -> mp4. Used by the look sheet.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { computeLayout } from '../src/core/layout';
import { drawScene, type SceneInput } from '../src/ui/draw/scene';
import type { Stage } from '../src/core/types';
import { renderPng } from './render-lib';

export async function renderClip(stage: Stage, out: string, opts: { seconds: number; celebrationAtBeat?: number; picks: number[]; fps?: number }): Promise<void> {
  const fps = opts.fps ?? 24;
  const W = 844, H = 390;
  const layout = computeLayout(W, H, 16, 40);
  const dir = `scripts/out/frames_${Date.now()}`;
  mkdirSync(dir, { recursive: true });
  const ids = opts.picks.map((i) => stage.creatures[i]!.id);
  const n = Math.round(opts.seconds * fps);
  for (let f = 0; f < n; f++) {
    const tMs = (f / fps) * 1000;
    const beat = (tMs / 1000) * (stage.bpm / 60);
    // creatures hop in one by one during the first bars
    const s: SceneInput = {
      layout, stage, muted: {}, solo: null, drags: [], returning: [], scrollX: 0, beat, timeMs: tMs, reduceMotion: false, celebration: null, hint: false, recordingBeat: null, hintSlot: 0,
      placed: ids.map((id, spot) => ({ id, spot, since: spot * 1200, from: layout.slotPos[opts.picks[spot]!]! })).filter((p) => p.since <= tMs),
    };
    if (opts.celebrationAtBeat !== undefined && beat >= opts.celebrationAtBeat) {
      s.celebration = { celebrationId: stage.combos[0]!.celebrationId, creatureIds: ids.slice(0, 4), startBeat: opts.celebrationAtBeat };
    }
    writeFileSync(`${dir}/f${String(f).padStart(4, '0')}.png`, await renderPng(W, H, (sk, c) => drawScene(sk, c, s), 1));
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${dir}/f%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', out]);
  rmSync(dir, { recursive: true, force: true });
}
