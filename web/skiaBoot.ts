// Browser Skia: CanvasKit (WebAssembly) behind the same API the app's draw code uses, so the web demo runs the app's own drawing functions.
import CanvasKitInit from 'canvaskit-wasm/bin/full/canvaskit.js';
import { JsiSkApi } from '@shopify/react-native-skia/lib/module/skia/web';
import type { SkiaApi } from '../src/ui/draw/common';

export interface Skia2 { sk: SkiaApi; ck: any }

export async function bootSkia(wasmUrl: string): Promise<Skia2> {
  const ck = await (CanvasKitInit as unknown as (o: unknown) => Promise<any>)({ locateFile: () => wasmUrl });
  (globalThis as unknown as { CanvasKit: unknown }).CanvasKit = ck;
  const sk = JsiSkApi(ck) as unknown as SkiaApi;
  return { sk, ck };
}
