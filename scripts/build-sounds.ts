// Synthesises every loop and encodes it to m4a. Run: npm run sounds [-- --only pond]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { lufs } from '../src/core/mix';
import { buildBonusPattern, buildPattern, type NoteEvent } from '../src/core/patterns';
import { TUNING } from '../src/core/tuning';
import { encodeWav } from '../src/core/wav';
import { buildStage, seedOf } from './build-content';
import { STAGES } from './stage-defs';
import { renderLoop, type LoopKind } from './synth';

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const WAV = 'scripts/out/wav';
const OUT = 'assets/loops';
mkdirSync(WAV, { recursive: true });
mkdirSync(OUT, { recursive: true });
mkdirSync('assets/sfx', { recursive: true });

const SAT = 0.55; // soft-clip knee: peaky loops (drums) are rounded instead of hard clipped
/** Normalise to the target loudness while keeping peaks under -1.5 dBFS (iterated soft saturation). */
function normalise(buf: Float32Array): { gainDb: number; lufs: number } {
  const src = buf.slice();
  let g = Math.pow(10, (TUNING.targetLufs - lufs(src)) / 20);
  for (let it = 0; it < 8; it++) {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh((src[i]! * g) / SAT) * SAT;
    g *= Math.pow(10, (TUNING.targetLufs - lufs(buf)) / 20);
  }
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh((src[i]! * g) / SAT) * SAT;
  return { gainDb: 20 * Math.log10(g), lufs: lufs(buf) };
}

export function encode(name: string, buf: Float32Array, dir = OUT): void {
  const wav = `${WAV}/${name}.wav`;
  writeFileSync(wav, encodeWav(buf, TUNING.sampleRate));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-ac', '1', `${dir}/${name}.m4a`]);
}

function emit(file: string, events: NoteEvent[], kind: LoopKind, stageIdx: number, seed: number): void {
  const d = STAGES[stageIdx]!;
  const buf = renderLoop(events, kind, d.bpm, d.timbre, seed);
  const n = normalise(buf);
  let peak = 0;
  for (const x of buf) peak = Math.max(peak, Math.abs(x));
  encode(file.replace('.m4a', ''), buf);
  console.log(`${file} lufs=${n.lufs.toFixed(1)} peak=${(20 * Math.log10(peak)).toFixed(1)}dB`);
}

STAGES.forEach((d, si) => {
  if (only && d.id !== only) return;
  const stage = buildStage(si);
  const base = { chordLoop: d.chords, key: d.key };
  stage.creatures.forEach((c, i) => {
    const layerIdx = ['drums', 'bass', 'melody', 'voice'].indexOf(c.layer);
    const v = i % 4;
    const seed = seedOf(si, layerIdx, v);
    emit(c.loopFile, buildPattern({ stage: base, layer: c.layer, variant: v, seed, swing: d.swing }), c.layer, si, seed);
  });
  stage.combos.forEach((c, i) => emit(c.bonusLoopFile, buildBonusPattern(base, i, 9000 + si * 10 + i), 'bonus', si, 9000 + si * 10 + i));
});

// Tick sounds: soft hi-hat ticks for the empty stage and the first-run count.
if (!only || only === 'pond') {
  for (const [name, vel] of [['tick', 0.5], ['tick_accent', 0.9]] as const) {
    const bpm = 120; // length is irrelevant for a one-shot; renderLoop wraps at 4 bars so slice the first 0.25 s
    const full = renderLoop([{ beat: 0, dur: 0.1, vel, drum: 'hat' }], 'drums', bpm, STAGES[0]!.timbre, 1);
    const shot = full.slice(0, Math.floor(TUNING.sampleRate * 0.25));
    for (let i = 0; i < shot.length; i++) shot[i]! *= 0.9 * Math.pow(1 - i / shot.length, 2);
    encode(name, shot, 'assets/sfx');
  }
}
if (!existsSync(`${OUT}/pond_drums_1.m4a`)) throw new Error('no output');
console.log('done');
