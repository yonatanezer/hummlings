// Offline synthesis of loops (build time only). Mono Float32 at 48 kHz.
import { midiHz } from '../src/core/music';
import { rng, type NoteEvent, type Syllable } from '../src/core/patterns';
import { TUNING, beatSec } from '../src/core/tuning';

const SR = TUNING.sampleRate;
const TAU = Math.PI * 2;

/** RBJ biquad. */
class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0; x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  static make(type: 'lp' | 'hp' | 'bp', f: number, q = 0.707): Biquad {
    const w = (TAU * Math.min(f, SR * 0.45)) / SR;
    const cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const bq = new Biquad();
    if (type === 'lp') { bq.b0 = (1 - cos) / 2 / a0; bq.b1 = (1 - cos) / a0; bq.b2 = bq.b0; }
    else if (type === 'hp') { bq.b0 = (1 + cos) / 2 / a0; bq.b1 = -(1 + cos) / a0; bq.b2 = bq.b0; }
    else { bq.b0 = alpha / a0; bq.b1 = 0; bq.b2 = -alpha / a0; }
    bq.a1 = (-2 * cos) / a0; bq.a2 = (1 - alpha) / a0;
    return bq;
  }
  p(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const noise = (r: () => number) => r() * 2 - 1;
const env = (t: number, a: number, d: number): number => (t < a ? t / a : Math.exp(-(t - a) / d));

export interface Timbre { melody: 'pluck' | 'bell' | 'flute'; voiceBrightness: number; bass: 'round' | 'fat' | 'soft'; kit: 'lofi' | 'bouncy' | 'soft' }

type Voice = (n: NoteEvent, bps: number, r: () => number) => { start: number; samples: Float32Array };

function drumVoice(n: NoteEvent, bps: number, r: () => number, kit: Timbre['kit']): Float32Array {
  const len = Math.floor(SR * 0.5);
  const o = new Float32Array(len);
  const v = n.vel;
  // Drum character per world: lofi = round and dusty, bouncy = snappy and bright, soft = brushed and gentle.
  const K = { lofi: { kf: 0.85, kd: 8, sf: 0.75, sd: 20, hf: 0.9, hamp: 0.7, lp: 4800 }, bouncy: { kf: 1.2, kd: 11, sf: 1.3, sd: 24, hf: 1.15, hamp: 1.05, lp: 8000 }, soft: { kf: 0.7, kd: 6, sf: 0.65, sd: 12, hf: 0.8, hamp: 0.55, lp: 3600 } }[kit];
  switch (n.drum) {
    case 'kick': { let ph = 0; for (let i = 0; i < len; i++) { const t = i / SR; const f = (45 + 90 * Math.exp(-t * 28)) * K.kf; ph += (TAU * f) / SR; o[i] = Math.sin(ph) * Math.exp(-t * K.kd) * 0.95 * v; } break; }
    case 'tom': { let ph = 0; for (let i = 0; i < len; i++) { const t = i / SR; const f = 110 + 90 * Math.exp(-t * 18); ph += (TAU * f) / SR; o[i] = Math.sin(ph) * Math.exp(-t * 11) * 0.8 * v; } break; }
    case 'snare': { const bp = Biquad.make('bp', 1900 * K.sf, 0.8), lp = Biquad.make('lp', Math.min(6500, K.lp + 1500)); for (let i = 0; i < len; i++) { const t = i / SR; const att = kit === 'soft' ? Math.min(1, t / 0.012) : 1; o[i] = (lp.p(bp.p(noise(r))) * 2.4 * att * Math.exp(-t * K.sd) + Math.sin(TAU * 190 * t) * Math.exp(-t * 28) * (kit === 'soft' ? 0.2 : 0.5)) * 0.7 * v; } break; }
    case 'clap': { const bp = Biquad.make('bp', 1300, 0.9); for (let i = 0; i < len; i++) { const t = i / SR; const burst = [0, 0.012, 0.024].reduce((a, s) => a + (t >= s ? Math.exp(-(t - s) * 90) : 0), 0) * 0.5 + Math.exp(-t * 18) * 0.6; o[i] = bp.p(noise(r)) * burst * 1.6 * v; } break; }
    case 'hat': case 'openhat': { const bp = Biquad.make('bp', 6000 * K.hf, 0.7), lp = Biquad.make('lp', Math.min(8000, K.lp + 1500)); const d = n.drum === 'hat' ? 0.03 : 0.16; for (let i = 0; i < len; i++) { const t = i / SR; o[i] = lp.p(bp.p(noise(r))) * Math.exp(-t / d) * 0.9 * K.hamp * v; } break; }
    case 'shaker': { const bp = Biquad.make('bp', 4200, 0.6), lp = Biquad.make('lp', 7500); for (let i = 0; i < len; i++) { const t = i / SR; o[i] = lp.p(bp.p(noise(r))) * env(t, 0.008, 0.04) * 0.9 * v; } break; }
    default: { for (let i = 0; i < len; i++) { const t = i / SR; o[i] = Math.sin(TAU * 820 * t) * Math.exp(-t * 55) * 0.6 * v + Math.sin(TAU * 1230 * t) * Math.exp(-t * 70) * 0.25 * v; } }
  }
  void bps;
  return o;
}

function bassVoice(kind: Timbre['bass']): Voice {
  return (n, bps) => {
    const dur = n.dur / bps;
    const len = Math.floor(SR * (dur + 0.25));
    const o = new Float32Array(len);
    const f = midiHz(n.midi!);
    const lp = Biquad.make('lp', kind === 'fat' ? 700 : kind === 'round' ? 420 : 260, 0.9);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      ph += (TAU * f) / SR;
      const e = Math.min(1, t / 0.006) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.06)) * (kind === 'soft' ? 1 : 0.5 + 0.5 * Math.exp(-t * 3));
      const saw = 2 * ((ph / TAU) % 1) - 1;
      const raw = Math.sin(ph) * 0.8 + Math.sin(2 * ph) * 0.18 + (kind === 'fat' ? saw * 0.35 : 0);
      o[i] = lp.p(raw) * e * 0.9 * n.vel;
    }
    return { start: 0, samples: o };
  };
}

function melodyVoice(kind: Timbre['melody']): Voice {
  return (n, bps) => {
    const dur = n.dur / bps;
    const tail = kind === 'bell' ? 1.0 : 0.5;
    const len = Math.floor(SR * (dur + tail));
    const o = new Float32Array(len);
    const f = midiHz(n.midi!);
    // Warm, rounded tones: harmonic FM (no metallic inharmonic partials), soft attack, and a low-pass that removes the shrill top end.
    const lp = Biquad.make('lp', kind === 'flute' ? 3300 : kind === 'bell' ? 2800 : 2600, 0.6);
    const lp2 = Biquad.make('lp', 3800, 0.5);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      let s: number;
      if (kind === 'bell') {
        const mod = Math.sin(TAU * f * 2 * t) * 0.7 * Math.exp(-t * 9);
        s = Math.sin(TAU * f * t + mod) * Math.exp(-t * 2.8) + 0.18 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 6);
      } else if (kind === 'pluck') {
        s = Math.sin(TAU * f * t) * Math.exp(-t * 5.5) + 0.22 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 11);
      } else {
        const vib = Math.sin(TAU * 5 * t) * 0.003 * Math.min(1, t / 0.3);
        s = (Math.sin(TAU * f * t * (1 + vib)) + 0.07 * Math.sin(TAU * f * 2 * t)) * Math.min(1, t / 0.05) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.14));
      }
      o[i] = lp2.p(lp.p(s * Math.min(1, t / 0.006))) * 0.6 * n.vel;
    }
    return { start: 0, samples: o };
  };
}

const FORMANTS: Record<Syllable, { v: [number, number, number][]; onset: 'b' | 'd' | 'l' | 'h' }> = {
  doo: { v: [[330, 70, 1], [800, 90, 0.35], [2500, 140, 0.1]], onset: 'd' }, // "oo"
  bah: { v: [[730, 90, 1], [1090, 110, 0.5], [2440, 160, 0.15]], onset: 'b' }, // "ah"
  la: { v: [[700, 90, 1], [1220, 110, 0.5], [2600, 160, 0.15]], onset: 'l' },
  hey: { v: [[530, 80, 1], [1840, 120, 0.5], [2480, 160, 0.15]], onset: 'h' }, // "eh"
};

function voiceVoice(brightness: number): Voice {
  return (n, bps, r) => {
    const dur = n.dur / bps;
    const len = Math.floor(SR * (dur + 0.12));
    const o = new Float32Array(len);
    const f = midiHz(n.midi!);
    const fm = FORMANTS[n.syl!];
    const filters = fm.v.map(([fc, bw, g]) => ({ bq: Biquad.make('bp', fc, fc / bw), g }));
    const lp = Biquad.make('lp', 3200 + brightness * 2500);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const vib = 1 + Math.sin(TAU * 5.5 * t) * 0.006 * Math.min(1, t / 0.2);
      ph += (TAU * f * vib) / SR;
      // glottal-ish source: band-limited saw (first 14 harmonics, rolled off)
      let src = 0;
      for (let h = 1; h <= 14; h++) if (f * h < 7000) src += Math.sin(h * ph) / h;
      let y = 0;
      for (const fl of filters) y += fl.bq.p(src) * fl.g;
      const amp = Math.min(1, t / 0.025) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.04));
      // consonant burst at the start
      const cons = t < 0.05 ? noise(r) * Math.exp(-t * (fm.onset === 'h' ? 40 : 90)) * (fm.onset === 'h' ? 0.12 : 0.18) : 0;
      o[i] = lp.p(y * 2.2 * amp + cons) * n.vel * 0.45;
    }
    return { start: 0, samples: o };
  };
}

export type LoopKind = 'drums' | 'bass' | 'melody' | 'voice' | 'bonus';

/** Renders a seamless 4-bar loop: events are rendered twice (the loop repeated) and the second pass is kept. */
export function renderLoop(events: NoteEvent[], kind: LoopKind, bpm: number, timbre: Timbre, seed: number): Float32Array {
  const bps = 1 / beatSec(bpm);
  const loopLen = Math.round(beatSec(bpm) * TUNING.beatsPerBar * TUNING.loopBars * SR);
  const buf = new Float32Array(loopLen * 3);
  const r = rng(seed);
  const kit = timbre.kit;
  const voice: Voice | null = kind === 'bass' ? bassVoice(timbre.bass) : kind === 'melody' ? melodyVoice(timbre.melody) : kind === 'bonus' ? melodyVoice('bell') : kind === 'voice' ? voiceVoice(timbre.voiceBrightness) : null;
  for (let pass = 0; pass < 2; pass++) {
    for (const n of events) {
      const startSample = Math.round((n.beat / bps) * SR) + pass * loopLen;
      const samples = voice ? voice(n, bps, r).samples : drumVoice(n, bps, r, kit);
      for (let i = 0; i < samples.length && startSample + i < buf.length; i++) buf[startSample + i]! += samples[i]!;
    }
  }
  // Light room: three decaying echoes mixed in (feeds back from earlier passes thanks to the wrap).
  const wet = kind === 'drums' ? 0.08 : 0.2;
  const taps: [number, number][] = [[0.173, 0.5], [0.289, 0.35], [0.421, 0.25]];
  const dry = buf.slice();
  const lpWet = Biquad.make('lp', 4500);
  for (const [s, g] of taps) {
    const d = Math.round(s * SR);
    for (let i = d; i < buf.length; i++) buf[i]! += lpWet.p(dry[i - d]!) * g * wet;
  }
  return buf.slice(loopLen, loopLen * 2);
}
