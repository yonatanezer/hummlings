import { useEffect, useMemo, useState, type ElementType } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STAGES, FREE_STAGE_IDS } from '../content';
import type { Stage } from '../core/types';
import { t, type StringKey } from '../i18n';
import { useLang } from '../i18n/useLang';
import { useProgress } from '../app/progress';
import { drawHomeBackdrop } from '../ui/draw/home';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { StageCardArt } from '../ui/StageCardArt';
import { WorldIcon } from '../ui/WorldIcon';
import { COLORS } from '../ui/theme';
import { hapticLight } from '../ui/haptics';

/** One world card: staggered entrance, a slow idle float, a press squash and (for the very first visit) a pulsing "start here" ring. */
function WorldCard({ stage, index, cardW, cardH, locked, found, hint, still, onPress }: {
  stage: Stage; index: number; cardW: number; cardH: number; locked: boolean; found: number; hint: boolean; still: boolean; onPress: () => void;
}) {
  const enter = useSharedValue(still ? 1 : 0);
  const bob = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (still) { enter.value = 1; return; }
    enter.value = withDelay(120 + index * 90, withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.4)) }));
    bob.value = withDelay(700 + index * 230, withRepeat(withSequence(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })), -1));
  }, [still]);
  useEffect(() => {
    if (hint && !still) pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1);
    else pulse.value = 0;
  }, [hint, still]);
  const lift = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: (1 - enter.value) * 26 - bob.value * 5 }, { scale: 0.92 + enter.value * 0.08 }] }));
  const ring = useAnimatedStyle(() => ({ opacity: hint ? 0.45 + pulse.value * 0.55 : 0, transform: [{ scale: 1 + pulse.value * 0.025 }] }));
  const total = stage.combos.length;
  const name = t(stage.nameKey as StringKey);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}${locked ? ', ' + t('select.locked') : ''}`}
      accessibilityHint={locked ? undefined : t('select.found', { n: found, m: total })}
      onPress={onPress}
      style={({ pressed }) => [{ width: cardW, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <Animated.View style={[{ alignItems: 'center', gap: 10 }, lift]}>
        <View>
          <Animated.View pointerEvents="none" style={[styles.ring, { width: cardW + 12, height: cardH + 12, borderRadius: 30 }, ring]} />
          <StageCardArt stage={stage} locked={locked} width={cardW} height={cardH} />
          <View style={styles.emblem}><WorldIcon stageId={stage.id} size={40} /></View>
          {locked && <View style={styles.lock}><Icon name="lock" size={28} color="#FFE8A3" /></View>}
          {hint && (
            <View style={styles.hintPill}><Icon name="play" size={16} color="#10282A" /><Text style={styles.hintText} numberOfLines={1}>{t('select.tapToPlay')}</Text></View>
          )}
        </View>
        <Text numberOfLines={2} style={[styles.name, { fontSize: Math.min(22, cardW * 0.13), maxWidth: cardW, minHeight: Math.min(22, cardW * 0.13) * 3, textAlign: 'center' }]}>{name}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {stage.combos.map((c, i) => <View key={c.id} style={[styles.dot, i < found ? styles.dotOn : styles.dotOff]} />)}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function StageSelectScreen({ onPick, onLocked, onSettings, onSongs, onHelp }: { onPick: (id: string) => void; onLocked: () => void; onSettings: () => void; onSongs: () => void; onHelp: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { rtl } = useLang();
  const { progress } = useProgress();
  const still = progress.settings.reduceMotion;
  // The buttons float above the cards, so the cards are centred in the space below them (not under them), and sized to fit one row when they can.
  const topBarH = insets.top + 6 + 84;
  const GAP = 14;
  // Measured width of the area the cards live in (the window width also counts the system bar, which pushed the row off-centre).
  const [areaW, setAreaW] = useState(0);
  // Centred on what the eye sees: the camera cut-out (left inset) and the navigation bar (right inset) both eat space, so the left inset is mirrored on the right.
  const availW = (areaW || width) - insets.left * 2 - insets.right - 32;
  const fitW = (availW - GAP * (STAGES.length - 1)) / STAGES.length;
  const cardW = Math.min(Math.max(fitW, 120), 260);
  const cardH = Math.min((height - topBarH - 90) * 0.9, cardW * 1.1);
  const row = rtl ? 'row-reverse' : 'row';
  const fits = STAGES.length * cardW + (STAGES.length - 1) * GAP <= availW;
  const Wrap = (fits ? View : ScrollView) as ElementType;
  const wrapProps: Record<string, unknown> = fits
    ? { style: { flexDirection: row, justifyContent: 'center', alignItems: 'flex-start', gap: GAP } }
    : { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: [styles.cards, { flexDirection: row, paddingHorizontal: 16, gap: GAP }] };
  const backdrop = useMemo(() => {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawHomeBackdrop(Skia, canvas, width, height);
    return rec.finishRecordingAsPicture();
  }, [width, height]);
  // New players are pointed at the free world; once anything was played the hint disappears.
  const firstVisit = !progress.firstDropDone && progress.discoveredCombos.length === 0 && progress.songs.length === 0;
  return (
    <View style={styles.root}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none"><Picture picture={backdrop} /></Canvas>
      <View style={[styles.top, { top: insets.top + 6, left: insets.left + 10, right: insets.right + 10, flexDirection: row }]}>
        <IconButton icon="note" label={t('a11y.songs')} caption={t('ui.songs')} onPress={onSongs} />
        <View style={styles.titleBox} pointerEvents="none">
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>{t('app.name')}</Text>
          <Text style={styles.subtitle} numberOfLines={1} adjustsFontSizeToFit>{t('app.subtitle')}</Text>
        </View>
        <View style={{ flexDirection: row, gap: 10 }}>
          <IconButton icon="help" label={t('a11y.help')} caption={t('ui.help')} onPress={onHelp} badge={!progress.helpSeen} />
          <IconButton icon="gear" label={t('a11y.settings')} caption={t('ui.settings')} onPress={onSettings} />
        </View>
      </View>
      <View style={{ alignSelf: 'stretch', marginTop: topBarH, paddingLeft: insets.left + 16, paddingRight: insets.left + insets.right + 16 }} onLayout={(e) => setAreaW(e.nativeEvent.layout.width)}>
        <Wrap {...wrapProps}>
          {STAGES.map((st, i) => {
            const locked = !FREE_STAGE_IDS.includes(st.id) && !progress.unlocked;
            const found = st.combos.filter((c) => progress.discoveredCombos.includes(c.id)).length;
            return (
              <WorldCard key={st.id} stage={st} index={i} cardW={cardW} cardH={cardH} locked={locked} found={found} still={still}
                hint={firstVisit && FREE_STAGE_IDS.includes(st.id)}
                onPress={() => { hapticLight(); if (locked) onLocked(); else onPick(st.id); }} />
            );
          })}
        </Wrap>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky, justifyContent: 'center' },
  top: { position: 'absolute', alignItems: 'flex-start', zIndex: 2 },
  titleBox: { flex: 1, alignItems: 'center', paddingTop: 2, paddingHorizontal: 8 },
  title: { color: '#FFFFFF', fontSize: 38, fontWeight: '900', letterSpacing: 1, textShadowColor: '#FF7AA8', textShadowRadius: 14, maxWidth: '100%' },
  subtitle: { color: COLORS.textDim, fontSize: 14, fontWeight: '600', maxWidth: '100%' },
  cards: { justifyContent: 'center', alignItems: 'flex-start' },
  name: { color: '#fff', fontSize: 22, fontWeight: '700' },
  emblem: { position: 'absolute', top: 10, left: 10, width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(27,19,64,0.92)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  lock: { position: 'absolute', top: 10, right: 10, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(27,19,64,0.8)', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: -6, left: -6, borderWidth: 3, borderColor: COLORS.glow },
  hintPill: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.glow, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  hintText: { color: '#10282A', fontSize: 14, fontWeight: '800' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotOn: { backgroundColor: COLORS.glow },
  dotOff: { backgroundColor: 'rgba(255,255,255,0.18)' },
});
