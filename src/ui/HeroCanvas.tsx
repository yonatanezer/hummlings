import { useCallback, useMemo } from 'react';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { FrameInfo } from 'react-native-reanimated';
import { STAGES } from '../content';
import { HERO_PICKS, drawHero, type HeroGeo, type HeroHit } from './draw/hero';

/** The six singers on the hill. Used by the intro (they drop in) and the home screen (they sing when touched). */
export function HeroCanvas({ geo, width, hits, introStart, gap = 300, still, clock }: {
  geo: HeroGeo; width: number; hits: SharedValue<HeroHit[]>; introStart: SharedValue<number>; gap?: number; still: boolean; clock?: SharedValue<number>;
}) {
  const own = useSharedValue(0);
  const time = clock ?? own;
  const base = useSharedValue(-1);
  const last = useSharedValue(0);
  // One stable callback (an inline one re-registers on every render and restarts the clock). Idle life only needs ~30 fps; a touch or the intro gets full rate.
  const onFrame = useCallback((info: FrameInfo) => {
    'worklet';
    if (base.value < 0) base.value = info.timestamp - time.value;
    const t = info.timestamp - base.value;
    const busy = introStart.value >= 0 || hits.value.length > 0;
    if (t - last.value < (busy ? 15 : 32)) return;
    last.value = t;
    time.value = t;
    if (hits.value.length > 0 && hits.value.every((h) => t - h.t > 1100)) hits.value = [];
  }, [base, time, last, introStart, hits]);
  useFrameCallback(onFrame);
  const creatures = useMemo(() => HERO_PICKS.map((i) => STAGES[0]!.creatures[i]!), []);
  const picture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, geo.height));
    drawHero(Skia, canvas, creatures, geo, width, time.value, hits.value, introStart.value, gap, still);
    return rec.finishRecordingAsPicture();
  });
  return <Canvas style={{ width, height: geo.height }} pointerEvents="none"><Picture picture={picture} /></Canvas>;
}
