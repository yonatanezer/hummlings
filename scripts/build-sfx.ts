// Synthesises the small UI sounds. Run: npx tsx scripts/build-sfx.ts  (also called by npm run sounds)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { rng } from '../src/core/patterns';
import { encodeWav } from '../src/core/wav';

const SR = 48000, TAU = Math.PI * 2;
const mk = (sec: number) => new Float32Array(Math.round(sec * SR));
const bell = (o: Float32Array, start: number, f: number, amp: number, decay: number) => {
  for (let i = 0; i < o.length - start; i++) { const t = i / SR; o[start + i]! += amp * Math.sin(TAU * f * t + 1.4 * Math.sin(TAU * f * 3.5 * t) * Math.exp(-t * 6)) * Math.exp(-t * decay); }
};
const sweep = (sec: number, f0: number, f1: number, decay: number, amp = 0.7) => {
  const o = mk(sec); let ph = 0;
  for (let i = 0; i < o.length; i++) { const t = i / SR, f = f0 + (f1 - f0) * Math.min(1, t / (sec * 0.6)); ph += (TAU * f) / SR; o[i] = Math.sin(ph) * Math.min(1, t / 0.004) * Math.exp(-t * decay) * amp; }
  return o;
};
const sounds: Record<string, Float32Array> = {};
{ // pop: recorded on A4, re-pitched at play time to the stage key
  const o = mk(0.25);
  for (let i = 0; i < o.length; i++) { const t = i / SR; o[i] = (Math.sin(TAU * 440 * t) + 0.3 * Math.sin(TAU * 880 * t) * Math.exp(-t * 40)) * Math.min(1, t / 0.003) * Math.exp(-t * 20) * 0.7; }
  sounds.pop = o;
}
sounds.pickup = sweep(0.09, 700, 1100, 38, 0.45);
sounds.mute = sweep(0.14, 330, 200, 22);
sounds.unmute = sweep(0.14, 200, 330, 22);
sounds.remove = sweep(0.2, 600, 240, 16);
{ const o = mk(0.9); [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(o, Math.round(i * 0.085 * SR), f, 0.35, 5)); sounds.goal = o; }
{
  const o = mk(1.5), r = rng(3); let lp = 0;
  for (let i = 0; i < Math.round(0.7 * SR); i++) { const t = i / SR, k = 0.02 + 0.5 * (t / 0.7) ** 2; lp += k * ((r() * 2 - 1) - lp); o[i] = lp * (t / 0.7) * 1.6; }
  [440, 554.4, 659.3, 880].forEach((f) => bell(o, Math.round(0.7 * SR), f, 0.22, 3.2));
  sounds.combo = o;
}
{
  const o = mk(0.25), r = rng(4); let b1 = 0, b2 = 0;
  for (let i = 0; i < o.length; i++) { const t = i / SR, n = r() * 2 - 1; b1 += 0.3 * (n - b1); b2 += 0.3 * (b1 - b2); o[i] = ((b1 - b2) * 3 * Math.exp(-t * 22) + Math.sin(TAU * 190 * t) * Math.exp(-t * 30) * 0.4) * 0.8; }
  sounds.snare = o;
}
mkdirSync('scripts/out/wav', { recursive: true });
mkdirSync('assets/sfx', { recursive: true });
for (const [name, buf] of Object.entries(sounds)) {
  let peak = 0; for (const x of buf) peak = Math.max(peak, Math.abs(x));
  for (let i = 0; i < buf.length; i++) buf[i] = (buf[i]! / peak) * 0.8;
  writeFileSync(`scripts/out/wav/sfx_${name}.wav`, encodeWav(buf, SR));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `scripts/out/wav/sfx_${name}.wav`, '-c:a', 'aac', '-b:a', '96k', `assets/sfx/${name}.m4a`]);
}
console.log('sfx done', Object.keys(sounds).join(','));
