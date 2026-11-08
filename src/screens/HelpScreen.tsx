import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STAGES } from '../content';
import { useProgress } from '../app/progress';
import { t, type StringKey } from '../i18n';
import { useLang } from '../i18n/useLang';
import { HELP_STEPS, drawHelpStep } from '../ui/draw/help';
import { IconButton } from '../ui/IconButton';
import { COLORS } from '../ui/theme';

/** Beginner's guide: 7 short animated lessons with one sentence each. Opened from the help button. */
export function HelpScreen({ onBack }: { onBack: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { rtl } = useLang();
  const { update } = useProgress();
  const [step, setStep] = useState(0);
  const time = useSharedValue(0);
  const stepSV = useSharedValue(0);
  useFrameCallback((i) => { time.value = i.timeSinceFirstFrame; });
  useEffect(() => { stepSV.value = step; }, [step, stepSV]);
  useEffect(() => { update((p) => (p.helpSeen ? p : { ...p, helpSeen: true })); }, [update]);

  const stage = STAGES[0]!;
  const cw = Math.min(width * 0.62, 640), ch = Math.min(height * 0.62, cw * 0.55);
  const picture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, cw, ch));
    drawHelpStep(Skia, canvas, stage, stepSV.value, time.value, cw, ch);
    return rec.finishRecordingAsPicture();
  });
  const last = step === HELP_STEPS - 1;
  const row = rtl ? 'row-reverse' : 'row';
  return (
    <View style={styles.root}>
      <View style={[styles.top, { top: insets.top + 6, left: insets.left + 10, right: insets.right + 10, flexDirection: row }]}>
        <IconButton icon="back" label={t('a11y.back')} onPress={onBack} />
        <Text style={styles.title} accessibilityRole="header">{t('help.title')}</Text>
      </View>
      <View style={styles.center}>
        <View style={[styles.card, { width: cw, height: ch }]}><Canvas style={{ width: cw, height: ch }}><Picture picture={picture} /></Canvas></View>
        <Text style={[styles.caption, { width: Math.min(cw, 640) }]} accessibilityLiveRegion="polite">{t(`help.step${step + 1}` as StringKey)}</Text>
        <View style={{ flexDirection: row, alignItems: 'center', gap: 20 }}>
          <IconButton icon="back" label={t('a11y.prev')} onPress={() => setStep((s) => Math.max(0, s - 1))} bg={step === 0 ? 'rgba(255,255,255,0.08)' : undefined} />
          <View style={{ flexDirection: row, gap: 8 }}>
            {Array.from({ length: HELP_STEPS }, (_, i) => <View key={i} style={[styles.dot, i === step && styles.dotOn]} />)}
          </View>
          <IconButton icon={last ? 'check' : 'next'} label={last ? t('help.dontShow') : t('a11y.next')} bg={last ? COLORS.ok : undefined} color={last ? '#10282A' : undefined} onPress={() => (last ? onBack() : setStep((s) => s + 1))} />
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky },
  top: { position: 'absolute', alignItems: 'center', gap: 16, zIndex: 2 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 36 },
  card: { borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,232,163,0.4)' },
  caption: { color: '#fff', fontSize: 18, textAlign: 'center', lineHeight: 26, minHeight: 56 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { backgroundColor: COLORS.glow, width: 28 },
});
