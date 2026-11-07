// Headless Skia (CanvasKit in Node): renders the SAME draw functions the app uses into PNG buffers.
import CanvasKitInit from 'canvaskit-wasm/bin/full/canvaskit.js';
import { getSkiaExports, makeOffscreenSurface } from '@shopify/react-native-skia/lib/module/headless';
import type { SkiaApi, Canvas } from '../src/ui/draw/common';

let sk: SkiaApi | null = null;

export async function initSkia(): Promise<SkiaApi> {
  if (sk) return sk;
  (globalThis as unknown as { CanvasKit: unknown }).CanvasKit = await (CanvasKitInit as unknown as (o: unknown) => Promise<unknown>)({
    locateFile: (f: string) => `node_modules/canvaskit-wasm/bin/full/${f}`,
  });
  sk = getSkiaExports().Skia as unknown as SkiaApi;
  return sk;
}

export async function renderPng(w: number, h: number, draw: (sk: SkiaApi, c: Canvas) => void, scale = 1): Promise<Buffer> {
  const skia = await initSkia();
  const surface = makeOffscreenSurface(Math.round(w * scale), Math.round(h * scale));
  const canvas = surface.getCanvas();
  canvas.scale(scale, scale);
  draw(skia, canvas as unknown as Canvas);
  surface.flush();
  const img = surface.makeImageSnapshot();
  return Buffer.from(img.encodeToBytes());
}
