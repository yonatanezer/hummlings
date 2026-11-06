import { TUNING } from './tuning';

/** Soft limiter: look-ahead peak limiter with smoothed gain. Same code for audit and export. */
export interface LimiterStats {
  maxGainReductionDb: number;
  peakDb: number; // peak after limiting
}

const LOOKAHEAD_MS = 5; // short enough to be inaudible as latency, long enough to catch peaks
const RELEASE_MS = 120; // slow release avoids pumping on bass notes

export function limit(buf: Float32Array, sampleRate = TUNING.sampleRate): LimiterStats {
  const ceil = Math.pow(10, TUNING.masterLimiterDb / 20);
  const look = Math.max(1, Math.round((LOOKAHEAD_MS / 1000) * sampleRate));
  const rel = Math.exp(-1 / ((RELEASE_MS / 1000) * sampleRate));
  const n = buf.length;
  // Required gain per sample, then a look-ahead running minimum, then smoothing (instant attack via lookahead).
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.abs(buf[i]!);
    need[i] = a > ceil ? ceil / a : 1;
  }
  // Sliding-window minimum over [i, i+look] using a monotonic deque.
  const dq = new Int32Array(n);
  const wmin = new Float32Array(n);
  let head = 0;
  let tail = 0;
  let next = 0;
  for (let i = 0; i < n; i++) {
    const hi = Math.min(n - 1, i + look);
    while (next <= hi) {
      while (tail > head && need[dq[tail - 1]!]! >= need[next]!) tail--;
      dq[tail++] = next++;
    }
    while (dq[head]! < i) head++;
    wmin[i] = need[dq[head]!]!;
  }
  // Release smoothing on the "needed" curve, then a boxcar average over the past `look` samples.
  // Since every term in the average is <= need[i] for the window that contains i, the output never exceeds the ceiling.
  const gr = new Float32Array(n);
  let prev = 1;
  for (let i = 0; i < n; i++) {
    const t = wmin[i]!;
    prev = t < prev ? t : Math.min(t, 1 - (1 - prev) * rel);
    gr[i] = prev;
  }
  let minG = 1;
  let peak = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += gr[i]!;
    if (i > look) acc -= gr[i - look - 1]!;
    const cnt = Math.min(i + 1, look + 1);
    const g = acc / cnt;
    const out = buf[i]! * g;
    buf[i] = out;
    if (g < minG) minG = g;
    const ab = Math.abs(out);
    if (ab > peak) peak = ab;
  }
  return {
    maxGainReductionDb: minG >= 1 ? 0 : -20 * Math.log10(minG),
    peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
  };
}

/** RMS loudness in dBFS (simple, unweighted) — used for relative checks. */
export function rmsDb(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i]! * buf[i]!;
  const r = Math.sqrt(s / Math.max(1, buf.length));
  return r > 0 ? 20 * Math.log10(r) : -Infinity;
}

/** K-weighted integrated loudness (ITU-R BS.1770) for mono, 48 kHz only. Gating omitted: loops are steady. */
export function lufs(buf: Float32Array, sampleRate = TUNING.sampleRate): number {
  if (sampleRate !== 48000) throw new Error('lufs(): 48 kHz only');
  // Stage 1: high shelf. Stage 2: high-pass (coefficients from BS.1770 at 48 kHz).
  const b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285];
  const a1 = [1, -1.69065929318241, 0.73248077421585];
  const b2 = [1, -2, 1];
  const a2 = [1, -1.99004745483398, 0.99007225036621];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, v1 = 0, v2 = 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i]!;
    const y = b1[0]! * x + b1[1]! * x1 + b1[2]! * x2 - a1[1]! * y1 - a1[2]! * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    const v = b2[0]! * y + b2[1]! * u1 + b2[2]! * u2 - a2[1]! * v1 - a2[2]! * v2;
    u2 = u1; u1 = y; v2 = v1; v1 = v;
    sum += v * v;
  }
  const ms = sum / Math.max(1, buf.length);
  return ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity;
}

/** Transfer curve for the live master soft-clipper (WaveShaper): linear up to the knee, then eases to the ceiling. */
export function softClipCurve(points = 2049): Float32Array {
  const ceil = Math.pow(10, TUNING.masterLimiterDb / 20);
  const knee = 0.5; // below -6 dBFS the curve is perfectly linear
  const out = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee));
    out[i] = Math.sign(x) * y;
  }
  return out;
}
