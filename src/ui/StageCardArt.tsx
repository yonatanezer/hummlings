import { useMemo } from 'react';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { Stage } from '../core/types';
import { drawStageCard } from './draw/stageCard';

export function StageCardArt({ stage, locked, width, height }: { stage: Stage; locked: boolean; width: number; height: number }) {
  const picture = useMemo(() => {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawStageCard(Skia, canvas, stage, width, height, locked);
    return rec.finishRecordingAsPicture();
  }, [stage, locked, width, height]);
  return <Canvas style={{ width, height }} pointerEvents="none"><Picture picture={picture} /></Canvas>;
}
