import { useMemo } from 'react';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { Combo, Stage } from '../core/types';
import { drawComboCard } from './draw/comboCard';

export function ComboCardArt({ stage, combo, discovered, width, height }: { stage: Stage; combo: Combo; discovered: boolean; width: number; height: number }) {
  const picture = useMemo(() => {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawComboCard(Skia, canvas, stage, combo, width, height, discovered);
    return rec.finishRecordingAsPicture();
  }, [stage, combo, discovered, width, height]);
  return <Canvas style={{ width, height }}><Picture picture={picture} /></Canvas>;
}
