import { useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEngine } from '../audio';
import { STAGES, FREE_STAGE_IDS } from '../content';
import type { Stage } from '../core/types';
import { t, type StringKey } from '../i18n';
import { useLang } from '../i18n/useLang';
import { useProgress } from '../app/progress';
import { drawHomeBackdrop } from '../ui/draw/home';
import { HERO_NOTES, heroGeometry, heroHitTest, paddedGeo, type HeroHit } from '../ui/draw/hero';
import { HeroCanvas } from '../ui/HeroCanvas';
import { HomeTitle, TITLE_SIDE } from '../ui/HomeTitle';
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
  const em = Math.min(56, cardH * 0.52);
  const lk = Math.min(48, cardH * 0.46);
  const fs = Math.min(18, cardW * 0.12);
  const name = t(stage.nameKey as StringKey);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}${locked ? ', ' + t('select.locked') : ''}`}
      accessibilityHint={locked ? undefined : t('select.found', { n: found, m: total })}
      onPress={onPress}
      style={({ pressed }) => [{ width: cardW, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <Animated.View style={[{ alignItems: 'center', gap: 6 }, lift]}>
        <View>
          <Animated.View pointerEvents="none" style={[styles.ring, { width: cardW + 12, height: cardH + 12, borderRadius: 26 }, ring]} />
          <StageCardArt stage={stage} locked={locked} width={cardW} height={cardH} />
          <View style={[styles.emblem, { width: em, height: em, borderRadius: em / 2 }]}><WorldIcon stageId={stage.id} size={em * 0.7} /></View>
          {locked && <View style={[styles.lock, { width: lk, height: lk, borderRadius: lk / 2 }]}><Icon name="lock" size={lk * 0.58} color="#FFE8A3" /></View>}
          {hint && (
            <View style={styles.hintPill}><Icon name="play" size={16} color="#10282A" /><Text style={styles.hintText} numberOfLines={1}>{t('select.tapToPlay')}</Text></View>
          )}
        </View>
        <Text numberOfLines={2} style={[styles.name, { fontSize: fs, maxWidth: cardW, minHeight: fs * 2.6, textAlign: 'center' }]}>{name}</Text>
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
  const topBarH = insets.top + 6 + 84;
  const geo = useMemo(() => heroGeometry(width, height, topBarH, insets.left, insets.right), [width, height, topBarH, insets.left, insets.right]);
  // The hill runs on under the world cards, so there is no seam where the singers' zone ends.
  const padded = useMemo(() => paddedGeo(geo, height - geo.top), [geo, height]);
  // The world cards live below the hill of the singers and share what is left of the height.
  const cardsTop = geo.top + geo.height + 2;
  const GAP = 14;
  // Measured width of the area the cards live in (the window width also counts the system bar, which pushed the row off-centre).
  const [areaW, setAreaW] = useState(0);
  // Centred on what the eye sees: the camera cut-out (left inset) and the navigation bar (right inset) both eat space, so the left inset is mirrored on the right.
  const availW = (areaW || width) - insets.left * 2 - insets.right - 32;
  const fitW = (availW - GAP * (STAGES.length - 1)) / STAGES.length;
  const cardW = Math.min(Math.max(fitW, 110), 220);
  const nameBlock = Math.min(18, cardW * 0.12) * 2.8 + 12 + 24; // two-line name, dots, gaps and the float of the card
  const cardH = Math.max(52, Math.min(height - cardsTop - 8 - nameBlock, cardW * 0.78));
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

  // The singers: touch one (or slide over several) and it hops and sings its note; the wordmark swells with every note.
  const clock = useSharedValue(0);
  const hits = useSharedValue<HeroHit[]>([]);
  const introStart = useSharedValue(-1);
  const pulse = useSharedValue(0);
  const hitsRef = useRef<HeroHit[]>([]);
  const lastIdx = useRef(-1);
  useEffect(() => {
    // Decode the sounds now so the first touch answers at once; an idle audio context is suspended again.
    const engine = getEngine();
    void engine.init().then(async () => {
      engine.setVolume(progress.settings.musicVolume);
      if (engine.state === 'idle') engine.stop();
      // The free world is where a new player goes first: decode its loops now, while they look at the home screen (resolves once its bed is ready, the rest follows).
      const first = STAGES.find((st) => FREE_STAGE_IDS.includes(st.id));
      if (first && engine.state === 'idle') await engine.loadStage(first, { background: true });
    }).catch(() => undefined);
  }, []);
  const sing = (x: number, y: number) => {
    const i = heroHitTest(geo, x, y);
    if (i < 0) { lastIdx.current = -1; return; }
    if (i === lastIdx.current) return;
    lastIdx.current = i;
    hapticLight();
    const now = clock.value;
    hitsRef.current = [...hitsRef.current.filter((h) => now - h.t < 1100), { i, t: now }];
    hits.value = hitsRef.current;
    getEngine().playSfx('pop', HERO_NOTES[i]!);
    pulse.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 280 }));
  };
  return (
    <View style={styles.root}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none"><Picture picture={backdrop} /></Canvas>
      <View
        style={{ position: 'absolute', top: geo.top, left: 0, width, height: geo.height }}
        onTouchStart={(e) => sing(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        onTouchMove={(e) => sing(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        onTouchEnd={() => { lastIdx.current = -1; }}
        onTouchCancel={() => { lastIdx.current = -1; }}
        accessible={false}
      >
        <View style={{ position: 'absolute', top: -padded.pad, left: 0 }} pointerEvents="none">
          <HeroCanvas geo={padded.geo} width={width} hits={hits} introStart={introStart} still={still} clock={clock} />
        </View>
      </View>
      <View style={[styles.titleWrap, { top: insets.top + 6, left: insets.left + TITLE_SIDE, right: insets.right + TITLE_SIDE }]} pointerEvents="none">
        <HomeTitle title={t('app.name')} subtitle={t('app.subtitle')} pulse={pulse} />
      </View>
      <View style={[styles.top, { top: insets.top + 6, left: insets.left + 10, right: insets.right + 10, flexDirection: row }]}>
        <IconButton icon="note" label={t('a11y.songs')} caption={t('ui.songs')} onPress={onSongs} />
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: row, gap: 10 }}>
          <IconButton icon="help" label={t('a11y.help')} caption={t('ui.help')} onPress={onHelp} badge={!progress.helpSeen} />
          <IconButton icon="gear" label={t('a11y.settings')} caption={t('ui.settings')} onPress={onSettings} />
        </View>
      </View>
      <View style={{ position: 'absolute', top: cardsTop, left: 0, right: 0, paddingLeft: insets.left + 16, paddingRight: insets.left + insets.right + 16 }} onLayout={(e) => setAreaW(e.nativeEvent.layout.width)}>
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
  titleWrap: { position: 'absolute', alignItems: 'center' },
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
