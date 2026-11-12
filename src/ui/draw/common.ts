import type { SkCanvas, SkPaint, Skia as SkiaType } from '@shopify/react-native-skia';

// Numeric enum values (Skia's TileMode / PaintStyle / StrokeCap) so draw code needs no runtime import of Skia:
// the same functions run in the app (UI thread worklets) and in the headless look-sheet renderer in Node.
export const FILL = 0;
export const STROKE = 1;
export const CAP_ROUND = 1;
export const TILE_CLAMP = 0;

export type SkiaApi = typeof SkiaType;
export type Canvas = SkCanvas;

export function hexRgb(hex: string): [number, number, number] {
  'worklet';
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbHex(r: number, g: number, b: number): string {
  'worklet';
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** A rect as a plain object: Skia accepts it everywhere a rect is taken, and it avoids creating a JSI host object per call (sk.XYWHRect was ~11% of the UI thread). */
export function rect(x: number, y: number, width: number, height: number) {
  'worklet';
  return { x, y, width, height };
}

interface DrawCache { colors: Record<string, unknown>; paints: Record<string, SkPaint>; paintCount: number; mixes: Record<string, string>; mixCount: number }

/** Per-runtime cache (UI thread in the app, Node in tests). Lives on globalThis because worklet closures are copies and would not keep a module-level cache between calls. */
function cache(): DrawCache {
  'worklet';
  const g = globalThis as unknown as { __hummDraw?: DrawCache };
  if (!g.__hummDraw) g.__hummDraw = { colors: {}, paints: {}, paintCount: 0, mixes: {}, mixCount: 0 };
  return g.__hummDraw;
}

/** Mix two hex colours: t=0 -> a, t=1 -> b. Results are cached: creatures asked for the same ~10 mixes every frame, each one parsing and formatting strings. */
export function mix(a: string, b: string, t: number): string {
  'worklet';
  const mc = cache().mixes;
  const key = `${a}|${b}|${t}`;
  const hit = mc[key];
  if (hit !== undefined) return hit;
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  const out = rgbHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
  const cc = cache();
  if (cc.mixCount > 1500) { cc.mixes = {}; cc.mixCount = 0; }
  cc.mixes[key] = out;
  cc.mixCount++;
  return out;
}

/** Parsed colour for a '#RRGGBB' string: parsing a string per call was one of the largest per-frame costs on a device. Callers must not mutate the result. */
export function skColor(sk: SkiaApi, hex: string) {
  'worklet';
  const cc = cache().colors;
  let v = cc[hex];
  if (v === undefined) { v = sk.Color(hex); cc[hex] = v; }
  return v as ReturnType<SkiaApi['Color']>;
}

/** A new paint the caller owns (may be mutated, e.g. to change alpha inside a loop). */
export function freshPaint(sk: SkiaApi, color: string, alpha = 1, style?: number, width = 0): SkPaint {
  'worklet';
  const st = style ?? FILL;
  const p = sk.Paint();
  p.setAntiAlias(true);
  p.setColor(skColor(sk, color));
  p.setAlphaf(alpha);
  p.setStyle(st);
  if (st === STROKE) {
    p.setStrokeWidth(width);
    p.setStrokeCap(CAP_ROUND);
  }
  return p;
}

// (freshPaint must stay above paint: a worklet captures helpers declared before it, not after.)
/** Shared, immutable paint for a colour / alpha / style / width. NEVER mutate the result (use freshPaint for that). Output is pixel-identical to creating a new paint each call. */
export function paint(sk: SkiaApi, color: string, alpha = 1, style?: number, width = 0): SkPaint {
  'worklet';
  // Default resolved in the body: a default-param expression is not captured into the worklet closure ('FILL' doesn't exist).
  const st = style ?? FILL;
  const cch = cache();
  const key = `${color}|${alpha}|${st}|${width}`;
  const hit = cch.paints[key];
  if (hit) return hit;
  if (cch.paintCount > 600) { cch.paints = {}; cch.paintCount = 0; } // continuous alphas (fades) would otherwise grow the cache without bound
  const p = freshPaint(sk, color, alpha, st, width);
  cch.paints[key] = p;
  cch.paintCount++;
  return p;
}

export function gradientPaint(sk: SkiaApi, x0: number, y0: number, x1: number, y1: number, colors: string[], alpha = 1): SkPaint {
  'worklet';
  const p = sk.Paint();
  p.setAntiAlias(true);
  p.setShader(sk.Shader.MakeLinearGradient({ x: x0, y: y0 }, { x: x1, y: y1 }, colors.map((c) => skColor(sk, c)), null, TILE_CLAMP));
  p.setAlphaf(alpha);
  return p;
}

export function radialPaint(sk: SkiaApi, cx: number, cy: number, r: number, colors: string[], alpha = 1): SkPaint {
  'worklet';
  const p = sk.Paint();
  p.setAntiAlias(true);
  p.setShader(sk.Shader.MakeRadialGradient({ x: cx, y: cy }, r, colors.map((c) => skColor(sk, c)), null, TILE_CLAMP));
  p.setAlphaf(alpha);
  return p;
}

/** Desaturating colour filter paint for layers (saturation 1 = unchanged, 0 = grey). */
export function saturationLayerPaint(sk: SkiaApi, saturation: number, alpha: number): SkPaint {
  'worklet';
  const s = saturation;
  const lr = 0.2126, lg = 0.7152, lb = 0.0722;
  const m = [
    lr + (1 - lr) * s, lg - lg * s, lb - lb * s, 0, 0,
    lr - lr * s, lg + (1 - lg) * s, lb - lb * s, 0, 0,
    lr - lr * s, lg - lg * s, lb + (1 - lb) * s, 0, 0,
    0, 0, 0, 1, 0,
  ];
  const p = sk.Paint();
  p.setColorFilter(sk.ColorFilter.MakeMatrix(m));
  p.setAlphaf(alpha);
  return p;
}
