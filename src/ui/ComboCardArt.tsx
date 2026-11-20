import { useMemo } from 'react';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import type { Combo, Stage } from '../core/types';
import { drawComboCard } from './draw/comboCard';

export function ComboCardArt({ stage, combo, discovered, width, height, have = [] }: { stage: Stage; combo: Combo; discovered: boolean; width: number; height: number; have?: readonly string[] }) {
  const haveKey = have.join('|'); // keyed by content, not identity (a new array every render)
  const picture = useMemo(() => {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawComboCard(Skia, canvas, stage, combo, width, height, discovered, have);
    return rec.finishRecordingAsPicture();
  }, [stage, combo, discovered, width, height, haveKey]);
  return <Canvas style={{ width, height }}><Picture picture={picture} /></Canvas>;
}
