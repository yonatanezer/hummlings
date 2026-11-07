import { useEffect } from 'react';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { Layout } from '../core/layout';
import type { Stage } from '../core/types';
import { drawScene, type DragCreature, type PlacedCreature, type ReturningCreature, type SceneInput } from './draw/scene';

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
    volumes: useSharedValue<Record<string, number>>({}),
    reduceMotion: useSharedValue(reduceMotion),
    timeMs: useSharedValue(0),
  };
  useEffect(() => { sv.layout.value = layout; }, [layout, sv.layout]);
  useEffect(() => { sv.stage.value = stage; }, [stage, sv.stage]);
  useEffect(() => { sv.reduceMotion.value = reduceMotion; }, [reduceMotion, sv.reduceMotion]);
  return sv;
}

export function SceneCanvas({ sv, width, height }: { sv: SceneValues; width: number; height: number }) {
  const clock = sv.timeMs;
  useFrameCallback((info) => {
    clock.value = info.timeSinceFirstFrame;
  });
  const picture = useDerivedValue(() => {
    const input: SceneInput = {
      layout: sv.layout.value, stage: sv.stage.value, placed: sv.placed.value, muted: sv.muted.value, solo: sv.solo.value,
      drags: sv.drags.value, returning: sv.returning.value, scrollX: sv.scrollX.value, beat: sv.beat.value, timeMs: clock.value,
      reduceMotion: sv.reduceMotion.value, celebration: sv.celebration.value, hint: sv.hint.value, hintSlot: sv.hintSlot.value, popup: sv.popup.value, volumes: sv.volumes.value, recordingBeat: null,
    };
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawScene(Skia, canvas, input);
    return rec.finishRecordingAsPicture();
  });
  return (
    <Canvas style={{ width, height }}>
      <Picture picture={picture} />
    </Canvas>
  );
}
