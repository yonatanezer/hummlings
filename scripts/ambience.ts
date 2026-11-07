// Quiet looping bed that gives each world its own atmosphere (heard under everything, even on an empty stage).
import { chordPitchClasses, midiHz, notesIn, scalePitchClasses } from '../src/core/music';
import { rng } from '../src/core/patterns';
import { TUNING, beatSec } from '../src/core/tuning';
import type { StageDef } from './stage-defs';

const SR = TUNING.sampleRate, TAU = Math.PI * 2;

export function renderAmbience(d: StageDef): Float32Array {
  const bar = beatSec(d.bpm) * TUNING.beatsPerBar;
  const loop = Math.round(bar * TUNING.loopBars * SR);
  const buf = new Float32Array(loop * 3);
  const r = rng(77 + d.bpm);
  const scale = scalePitchClasses(d.key);
  const add = (start: number, len: number, fn: (t: number) => number) => {
    for (let i = 0; i < len && start + i < buf.length; i++) buf[start + i]! += fn(i / SR);
  };
  for (let pass = 0; pass < 2; pass++) {
    const off = pass * loop;
    // soft pad: the chord of each bar, crossfaded
    d.chords.forEach((ch, b) => {
      const pcs = chordPitchClasses(ch);
      const notes = pcs.flatMap((pc) => notesIn([pc], 48, 64).slice(0, 1));
      const start = off + Math.round(b * bar * SR) - Math.round(bar * 0.25 * SR);
      const len = Math.round(bar * 1.5 * SR);
      for (const m of notes) {
        const f = midiHz(m);
        add(Math.max(0, start), len, (t) => {
          const e = Math.sin(Math.PI * Math.min(1, t / (len / SR))) ** 2;
          return e * 0.12 * (Math.sin(TAU * f * t) + 0.4 * Math.sin(TAU * f * 2 * t + 1) + 0.15 * Math.sin(TAU * f * 3.01 * t)) * (1 + 0.06 * Math.sin(TAU * 0.3 * t));
        });
      }
    });
    if (d.id === 'pond') {
      // crickets: chirps of 4 kHz pulses; water plinks on the scale
      for (let k = 0; k < 14; k++) {
        const t0 = off + Math.round(r() * loop);
        const f = 3900 + r() * 500;
        add(t0, Math.round(0.18 * SR), (t) => Math.sin(TAU * f * t) * (0.5 + 0.5 * Math.sign(Math.sin(TAU * 38 * t))) * Math.min(1, t * 60) * Math.max(0, 1 - t / 0.18) * 0.05);
      }
      for (let k = 0; k < 7; k++) {
        const t0 = off + Math.round(((k + r() * 0.6) / 7) * loop);
        const m = notesIn(scale, 76, 88)[Math.floor(r() * 8) % 8] ?? 79;
        const f = midiHz(m);
        add(t0, Math.round(1.2 * SR), (t) => Math.sin(TAU * f * t + 0.8 * Math.sin(TAU * f * 2.01 * t) * Math.exp(-t * 7)) * Math.exp(-t * 4.5) * 0.11);
      }
    } else if (d.id === 'fair') {
      // calliope: a soft reedy arpeggio on every eighth, plus a bright tick like a ride bell
      d.chords.forEach((ch, b) => {
        const tones = notesIn(chordPitchClasses(ch), 60, 79);
        for (let i = 0; i < 8; i++) {
          const m = tones[(i * 2 + b) % tones.length]!;
          const f = midiHz(m);
          const t0 = off + Math.round((b * 4 + i * 0.5) * beatSec(d.bpm) * SR);
          add(t0, Math.round(0.3 * SR), (t) => { let x = 0; for (let h = 1; h <= 9; h += 2) x += Math.sin(TAU * f * h * t) / h; return x * Math.exp(-t * 9) * Math.min(1, t * 200) * 0.07; });
        }
      });
    } else {
      // clouds: a slow breath of wind and wind chimes
      let lp = 0, lp2 = 0;
      for (let i = 0; i < loop; i++) {
        const t = i / SR, n = r() * 2 - 1;
        lp += 0.02 * (n - lp); lp2 += 0.05 * (lp - lp2);
        buf[off + i]! += lp2 * 9 * (0.5 + 0.5 * Math.sin(TAU * (t / (bar * 2)) - 1.2)) * 0.5;
      }
      for (let k = 0; k < 6; k++) {
        const t0 = off + Math.round(((k + r() * 0.5) / 6) * loop);
        const m = notesIn(scale, 84, 96)[Math.floor(r() * 7) % 7] ?? 88;
        const f = midiHz(m);
        add(t0, Math.round(1.6 * SR), (t) => (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2.76 * t)) * Math.exp(-t * 3) * Math.min(1, t * 400) * 0.08);
      }
    }
  }
  return buf.slice(loop, loop * 2);
}
