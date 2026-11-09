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

/** Mix two hex colours: t=0 -> a, t=1 -> b. */
export function mix(a: string, b: string, t: number): string {
  'worklet';
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  return rgbHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function paint(sk: SkiaApi, color: string, alpha = 1, style?: number, width = 0): SkPaint {
  'worklet';
  // Default resolved in the body: a default-param expression is not captured into the worklet closure ('FILL' doesn't exist).
  const st = style ?? FILL;
  const p = sk.Paint();
  p.setAntiAlias(true);
  p.setColor(sk.Color(color));
  p.setAlphaf(alpha);
  p.setStyle(st);
  if (st === STROKE) {
    p.setStrokeWidth(width);
    p.setStrokeCap(CAP_ROUND);
  }
  return p;
}

export function gradientPaint(sk: SkiaApi, x0: number, y0: number, x1: number, y1: number, colors: string[], alpha = 1): SkPaint {
  'worklet';
  const p = sk.Paint();
  p.setAntiAlias(true);
  p.setShader(sk.Shader.MakeLinearGradient({ x: x0, y: y0 }, { x: x1, y: y1 }, colors.map((c) => sk.Color(c)), null, TILE_CLAMP));
  p.setAlphaf(alpha);
  return p;
}

export function radialPaint(sk: SkiaApi, cx: number, cy: number, r: number, colors: string[], alpha = 1): SkPaint {
  'worklet';
  const p = sk.Paint();
  p.setAntiAlias(true);
  p.setShader(sk.Shader.MakeRadialGradient({ x: cx, y: cy }, r, colors.map((c) => sk.Color(c)), null, TILE_CLAMP));
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
