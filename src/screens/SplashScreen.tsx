import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { STAGES } from '../content';
import { t } from '../i18n';
import { drawSplash } from '../ui/draw/logo';
import { COLORS } from '../ui/theme';

/** Logo splash, 1.2 s max. */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const time = useSharedValue(0);
  useFrameCallback((i) => { time.value = i.timeSinceFirstFrame; });
  const creatures = STAGES[0]!.creatures.filter((_, i) => i % 2 === 0);
  const picture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawSplash(Skia, canvas, creatures, width, height, time.value);
    return rec.finishRecordingAsPicture();
  });
  useEffect(() => { const id = setTimeout(onDone, 1200); return () => clearTimeout(id); }, [onDone]);
  return (
    <View style={styles.root}>
      <Canvas style={{ width, height }}><Picture picture={picture} /></Canvas>
      <Text style={styles.title} accessibilityRole="header">{t('app.name')}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky },
  title: { position: 'absolute', top: '14%', alignSelf: 'center', color: '#FFFFFF', fontSize: 56, fontWeight: '800', letterSpacing: 1, textShadowColor: '#FF7AA8', textShadowRadius: 12 },
});
