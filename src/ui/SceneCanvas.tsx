import { useCallback, useEffect, useRef } from 'react';
import { PixelRatio } from 'react-native';
import { Canvas, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue, type FrameInfo, type SharedValue } from 'react-native-reanimated';
import type { Layout } from '../core/layout';
import type { Stage } from '../core/types';
import { drawBackdrop, drawScene, drawTray, type DragCreature, type PlacedCreature, type ReturningCreature, type SceneInput } from './draw/scene';

/** All inputs of the scene as shared values: updated on events (JS) and read every frame (UI thread). */
export interface SceneValues {
  layout: SharedValue<Layout>;
  stage: SharedValue<Stage>;
  placed: SharedValue<PlacedCreature[]>;
  muted: SharedValue<Record<string, true>>;
  solo: SharedValue<string | null>;
  drags: SharedValue<DragCreature[]>;
  returning: SharedValue<ReturningCreature[]>;
  scrollX: SharedValue<number>;
  beat: SharedValue<number>;
  celebration: SharedValue<SceneInput['celebration']>;
  hint: SharedValue<boolean>;
  hintSlot: SharedValue<number>;
  popup: SharedValue<SceneInput['popup']>;
  trayK: SharedValue<number>;
  reward: SharedValue<SceneInput['reward']>;
  taps: SharedValue<NonNullable<SceneInput['taps']>>;
  volumes: SharedValue<Record<string, number>>;
  reduceMotion: SharedValue<boolean>;
  timeMs: SharedValue<number>;
}

export function useSceneValues(stage: Stage, layout: Layout, reduceMotion: boolean): SceneValues {
  const sv: SceneValues = {
    layout: useSharedValue(layout),
    stage: useSharedValue(stage),
    placed: useSharedValue<PlacedCreature[]>([]),
    muted: useSharedValue<Record<string, true>>({}),
    solo: useSharedValue<string | null>(null),
    drags: useSharedValue<DragCreature[]>([]),
    returning: useSharedValue<ReturningCreature[]>([]),
    scrollX: useSharedValue(0),
    beat: useSharedValue(-1),
    celebration: useSharedValue<SceneInput['celebration']>(null),
    hint: useSharedValue(false),
    hintSlot: useSharedValue(0),
    popup: useSharedValue<SceneInput['popup']>(null),
    trayK: useSharedValue(1),
    reward: useSharedValue<SceneInput['reward']>(null),
    taps: useSharedValue<NonNullable<SceneInput['taps']>>([]),
    volumes: useSharedValue<Record<string, number>>({}),
    reduceMotion: useSharedValue(reduceMotion),
    timeMs: useSharedValue(0),
  };
  useEffect(() => { sv.layout.value = layout; }, [layout, sv.layout]);
  useEffect(() => { sv.stage.value = stage; }, [stage, sv.stage]);
  useEffect(() => { sv.reduceMotion.value = reduceMotion; }, [reduceMotion, sv.reduceMotion]);
  return sv;
}

function trayKeyOf(sv: SceneValues): string {
  'worklet';
  const layout = sv.layout.value, placed = sv.placed.value, drags = sv.drags.value;
  return `${sv.stage.value.id}|${layout.W}|${layout.H}|${layout.tray.y}|${layout.tray.h}|${layout.slot}|${placed.map((q) => q.id).join(',')}|${drags.map((d) => d.id).join(',')}|${sv.scrollX.value}`;
}
function backdropKeyOf(sv: SceneValues, bucket: number): string {
  'worklet';
  const layout = sv.layout.value;
  return `${sv.stage.value.id}|${layout.W}|${layout.H}|${layout.size}|${layout.stageH}|${bucket}`;
}

/** The tray / backdrop worklets re-ran on every frame (measured: tray 7.5 ms each), so they keep their last picture and reuse it while their inputs are unchanged. */
function memoPicture<T>(uid: string, name: string, key: string, make: () => T): T {
  'worklet';
  const g = globalThis as unknown as { __hummMemo?: Record<string, { key: string; value: unknown }> };
  if (!g.__hummMemo) g.__hummMemo = {};
  const slot = g.__hummMemo[uid + name];
  if (slot && slot.key === key) return slot.value as T;
  const value = make();
  g.__hummMemo[uid + name] = { key, value };
  return value;
}

export function SceneCanvas({ sv, width, height }: { sv: SceneValues; width: number; height: number }) {
  const clock = sv.timeMs;
  const uid = useRef(Math.random().toString(36).slice(2)).current;
  // The clock must never go backwards: creatures, hops and taps are stamped with it. useFrameCallback re-registers whenever its callback changes (and an inline one
  // changes on every render, i.e. on every drop), which restarted timeSinceFirstFrame at 0 and left earlier stamps "in the future": creatures froze where they were
  // dropped. So the callback is stable and the clock comes from the frame's absolute timestamp.
  const clockBase = useSharedValue(-1);
  const onFrame = useCallback((info: FrameInfo) => {
    'worklet';
    if (clockBase.value < 0) clockBase.value = info.timestamp - clock.value;
    const t = info.timestamp - clockBase.value;
    // Every tick redraws the whole scene. The display can run at 120 Hz but the art only needs 60: ticking at most every ~15 ms halves the UI-thread work.
    if (t - clock.value < 15) return;
    clock.value = t;
  }, [clock, clockBase]);
  useFrameCallback(onFrame);
  // The singer menu only changes on touches, so it is recorded once per change instead of every frame.
  // Each static layer is recorded as a Picture AND rasterised once into a device-resolution image, together, only when its key changes: replaying their vector ops every frame used to be a large share of the UI-thread time.
  const ratio = PixelRatio.get();
  const rasterise = (pic: SkPicture) => {
    'worklet';
    const surface = Skia.Surface.MakeOffscreen(Math.ceil(width * ratio), Math.ceil(height * ratio));
    if (!surface) return null;
    const canvas = surface.getCanvas();
    canvas.scale(ratio, ratio);
    canvas.drawPicture(pic);
    surface.flush();
    return surface.makeImageSnapshot();
  };
  const trayLayer = useDerivedValue(() => {
    const layout = sv.layout.value, stage = sv.stage.value, placed = sv.placed.value, drags = sv.drags.value, scrollX = sv.scrollX.value;
    return memoPicture(uid, 'tray', trayKeyOf(sv), () => {
      const input = { layout, stage, placed, drags, scrollX } as SceneInput;
      const rec = Skia.PictureRecorder();
      const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
      drawTray(Skia, canvas, input);
      // Not rasterised: the key includes the scroll offset, so a full-screen image per scroll tick (~10 MB each) blew the app up to >1 GB.
      return { pic: rec.finishRecordingAsPicture(), img: null as ReturnType<typeof rasterise> };
    });
  });
  // Sky, spotlights, floor and fixed scenery are recorded once per stage/size (neon windows once per 1.8 s) instead of every frame.
  const bucket = useDerivedValue(() => (sv.stage.value.id === 'neon' ? Math.floor(clock.value / 1800) : 0));
  const backdropLayer = useDerivedValue(() => {
    const layout = sv.layout.value, stage = sv.stage.value;
    return memoPicture(uid, 'backdrop', backdropKeyOf(sv, bucket.value), () => {
      const rec = Skia.PictureRecorder();
      const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
      drawBackdrop(Skia, canvas, stage, layout, bucket.value);
      const pic = rec.finishRecordingAsPicture();
      // Neon re-rolls its windows every 1.8 s: keep that one as a picture too, rather than allocating a ~10 MB image each time.
      return { pic, img: stage.id === 'neon' ? null : rasterise(pic) };
    });
  });
  const picture = useDerivedValue(() => {
    const input: SceneInput = {
      layout: sv.layout.value, stage: sv.stage.value, placed: sv.placed.value, muted: sv.muted.value, solo: sv.solo.value,
      drags: sv.drags.value, returning: sv.returning.value, scrollX: sv.scrollX.value, beat: sv.beat.value, timeMs: clock.value,
      reduceMotion: sv.reduceMotion.value, celebration: sv.celebration.value, hint: sv.hint.value, hintSlot: sv.hintSlot.value, popup: sv.popup.value, backdrop: backdropLayer.value.pic, trayPicture: trayLayer.value.pic, backdropImage: backdropLayer.value.img, trayImage: trayLayer.value.img, pixelRatio: ratio, trayK: sv.trayK.value, reward: sv.reward.value, taps: sv.taps.value, volumes: sv.volumes.value, recordingBeat: null,
    };
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawScene(Skia, canvas, input);
    const r = rec.finishRecordingAsPicture();
    return r;
  });
  return (
    <Canvas style={{ width, height }}>
      <Picture picture={picture} />
    </Canvas>
  );
}
