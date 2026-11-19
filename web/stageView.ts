// The stage, drawn by the app's own drawing code (src/ui/draw/scene.ts) through CanvasKit, so the web demo looks exactly like the app.
import { drawBackdrop, drawScene, drawTrayStrip, type SceneInput } from '../src/ui/draw/scene';
import type { Skia2 } from './skiaBoot';

type Img = { dispose?: () => void } | null;

export class StageView {
  private surface: any = null;
  private raw: any = null;
  private dpr = 1;
  private backdrop: { key: string; pic: any; img: Img } | null = null;
  private tray: { key: string; strip: Img; r: number } | null = null;

  constructor(private s: Skia2, private el: HTMLCanvasElement) {}

  /** (Re)creates the GPU/CPU surface for a new size. */
  resize(W: number, H: number, dpr: number) {
    this.dpr = dpr;
    this.el.width = Math.round(W * dpr); this.el.height = Math.round(H * dpr);
    this.release();
    const ck = this.s.ck;
    this.surface = (/[?&]sw=1/.test(location.search) ? null : ck.MakeWebGLCanvasSurface(this.el)) ?? ck.MakeSWCanvasSurface(this.el);
    this.raw = this.surface?.getCanvas() ?? null;
  }

  private release() {
    try { this.surface?.delete?.(); } catch { /* already gone */ }
    this.surface = null; this.raw = null;
    this.backdrop = null; this.tray = null;
  }

  /** The static layers are drawn once per change into a picture/raster, like the app does, and only the moving parts are redrawn each frame. */
  draw(input: SceneInput, W: number, H: number) {
    if (!this.raw) return;
    const { sk } = this.s;
    const layout = input.layout, stage = input.stage;
    const ratio = Math.min(2, this.dpr);
    const raster = (pic: any): Img => {
      const sf = sk.Surface.MakeOffscreen(Math.ceil(W * ratio), Math.ceil(H * ratio));
      if (!sf) return null;
      const cv = sf.getCanvas(); cv.scale(ratio, ratio); cv.drawPicture(pic); sf.flush();
      return sf.makeImageSnapshot() as unknown as Img;
    };
    const bucket = stage.id === 'neon' ? Math.floor(input.timeMs / 1800) : 0;
    const bKey = `${stage.id}|${layout.W}|${layout.H}|${layout.size}|${layout.stageH}|${bucket}`;
    if (!this.backdrop || this.backdrop.key !== bKey) {
      const rec = sk.PictureRecorder();
      const cv = rec.beginRecording({ x: 0, y: 0, width: W, height: H });
      drawBackdrop(sk, cv, stage, layout, bucket);
      const pic = rec.finishRecordingAsPicture();
      const img: Img = null; // the cached picture is replayed (a raster of it came out empty in the browser)
      try { this.backdrop?.img?.dispose?.(); } catch { /* ok */ }
      this.backdrop = { key: bKey, pic, img };
    }
    const tKey = `${stage.id}|${layout.W}|${layout.H}|${layout.tray.y}|${layout.tray.h}|${layout.slot}|${layout.u}|${layout.trayContentW}|${layout.slotPos[0]!.x}|${input.placed.map((q) => q.id).join(',')}|${input.drags.map((d) => d.id).join(',')}`;
    if (!this.tray || this.tray.key !== tKey) {
      const strip = this.makeStrip(input);
      try { this.tray?.strip?.dispose?.(); } catch { /* ok */ }
      this.tray = { key: tKey, strip: strip.img, r: strip.r };
    }
    const full: SceneInput = { ...input, backdrop: this.backdrop.pic, backdropImage: this.backdrop.img as never, trayStrip: this.tray.strip as never, trayStripRatio: this.tray.r, pixelRatio: ratio };
    const rec = sk.PictureRecorder();
    const cv = rec.beginRecording({ x: 0, y: 0, width: W, height: H });
    drawScene(sk, cv, full);
    const pic = rec.finishRecordingAsPicture();
    this.raw.clear(this.s.ck.Color4f(0, 0, 0, 0));
    this.raw.save();
    this.raw.scale(this.dpr, this.dpr);
    this.raw.drawPicture((pic as any).ref ?? pic);
    this.raw.restore();
    this.surface.flush();
    try { (pic as any).dispose?.(); } catch { /* ok */ }
  }

  private makeStrip(input: SceneInput): { img: Img; r: number } {
    const { sk } = this.s;
    const layout = input.layout;
    const last = layout.slotPos[layout.slotPos.length - 1]!;
    const stripW = Math.max(layout.W, last.x + layout.slot), stripH = layout.tray.h + 6;
    const r = Math.min(this.dpr, 3800 / stripW);
    const sf = sk.Surface.MakeOffscreen(Math.ceil(stripW * r), Math.ceil(stripH * r));
    if (!sf) return { img: null, r };
    const cv = sf.getCanvas();
    cv.scale(r, r);
    cv.translate(0, -layout.tray.y);
    drawTrayStrip(sk, cv, { ...input, scrollX: 0 });
    sf.flush();
    const snap = sf.makeImageSnapshot();
    // Re-create it from its pixels: an image taken from a software surface is not drawable in the page's WebGL context otherwise.
    const w = snap.width(), h = snap.height();
    const px = snap.readPixels(0, 0, { width: w, height: h, alphaType: 2, colorType: 4 } as never);
    const img = px ? sk.Image.MakeImage({ width: w, height: h, alphaType: 2, colorType: 4 } as never, sk.Data.fromBytes(px as Uint8Array), w * 4) : snap;
    return { img: img as unknown as Img, r };
  }
}
