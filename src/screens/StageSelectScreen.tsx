import { useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { CARD_BY_STAGE_INDEX, HOME_ART } from '../ui/homeArt';
import { COLORS } from '../ui/theme';
import { useReduceMotion } from '../ui/useReduceMotion';
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
    bob.value = withDelay(700 + index * 230, withRepeat(withSequence(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })), 2)); // a few floats, then rest: an endless loop kept the UI and render threads busy (about one core) on an idle home screen
  }, [still]);
  useEffect(() => {
    if (hint && !still) pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), 8); // the first-visit hint pulses for about 11 s, then stays lit
    else pulse.value = 0;
  }, [hint, still]);
  const lift = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: (1 - enter.value) * 26 - bob.value * 5 }, { scale: 0.92 + enter.value * 0.08 }] }));
  // For someone who cannot read: a finger bobs on the card they should press (same look as the hand on the stage)
  const fingerStyle = useAnimatedStyle(() => ({ opacity: hint ? 1 : 0, transform: [{ translateY: -pulse.value * 12 }, { scale: 1 - pulse.value * 0.1 }] }));
  const ring = useAnimatedStyle(() => ({ opacity: hint ? 0.45 + pulse.value * 0.55 : 0, transform: [{ scale: 1 + pulse.value * 0.025 }] }));
  const total = stage.combos.length;
  const lk = Math.min(44, cardH * 0.42);
  // the painted card is nearly square; it is never stretched
  const artW = Math.min(cardW, cardH * 0.99);
  const artH = artW * 0.99;
  const fs = Math.min(16, artW * 0.1);
  const name = t(stage.nameKey as StringKey);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}${locked ? ', ' + t('select.locked') : ''}`}
      accessibilityHint={locked ? undefined : t('select.found', { n: found, m: total })}
      onPress={onPress}
      style={({ pressed }) => [{ width: cardW, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <Animated.View style={[{ alignItems: 'center', gap: 6 }, lift]}>
        <View style={{ width: artW, height: artH }}>
          <Animated.View pointerEvents="none" style={[styles.ring, { width: artW + 12, height: artH + 12, borderRadius: 26 }, ring]} />
          <Image source={HOME_ART.cards[CARD_BY_STAGE_INDEX[index] ?? 0]} style={{ width: artW, height: artH }} resizeMode="contain" />
          <View style={[styles.pill, { top: artH * 0.795, height: artH * 0.15, left: artW * 0.12, right: artW * 0.12 }]} pointerEvents="none">
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.name, { fontSize: fs }]}>{name}</Text>
          </View>
          {locked && <View style={[styles.lock, { top: artH * 0.2 - lk * 0.33, left: artW * 0.82 - lk * 0.33, width: lk * 0.66, height: lk * 0.66, borderRadius: lk * 0.33 }]}><Icon name="lock" size={lk * 0.4} color="#FFE8A3" /></View>}
          {locked
            ? <View style={[styles.listen, { left: artW * 0.79 - lk * 0.43, top: artH * 0.6 - lk * 0.43, width: lk * 0.85, height: lk * 0.85, borderRadius: lk * 0.43 }]}><Icon name="note" size={lk * 0.5} color="#10282A" /></View>
            : index > 0 && <View style={[styles.listen, styles.count, { left: artW * 0.79 - lk * 0.43, top: artH * 0.6 - lk * 0.43, width: lk * 0.85, height: lk * 0.85, borderRadius: lk * 0.43 }]}><Icon name="star" size={lk * 0.5} color="#FFC857" /></View>}
          {hint && <Animated.View pointerEvents="none" style={[styles.finger, { top: artH * 0.42 }, fingerStyle]} />}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {stage.combos.map((c, i) => <View key={c.id} style={[styles.dot, i < found ? styles.dotOn : styles.dotOff]} />)}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function StageSelectScreen({ onPick, onLocked, onSettings, onSongs, onHelp }: { onPick: (id: string) => void; onLocked: (id: string) => void; onSettings: () => void; onSongs: () => void; onHelp: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { rtl } = useLang();
  const { progress } = useProgress();
  const still = useReduceMotion();
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
  const nameBlock = 14 + 12 + 24; // one-line name, dots, gaps and the float of the card
  const cardH = Math.max(52, Math.min(height - cardsTop - 8 - nameBlock, cardW * 0.92));
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
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={HOME_ART.planetRing} style={{ position: 'absolute', left: width * 0.8, top: height * 0.2, width: 78, height: 45, opacity: 0.9 }} resizeMode="contain" />
        <Image source={HOME_ART.planetB} style={{ position: 'absolute', left: width * 0.07, top: height * 0.3, width: 34, height: 33, opacity: 0.85 }} resizeMode="contain" />
        <Image source={HOME_ART.planetC} style={{ position: 'absolute', left: width * 0.66, top: height * 0.07, width: 22, height: 21, opacity: 0.8 }} resizeMode="contain" />
        <Image source={HOME_ART.comet} style={{ position: 'absolute', left: width * 0.28, top: height * 0.04, width: 64, height: 36, opacity: 0.85 }} resizeMode="contain" />
        <Image source={HOME_ART.cloudA} style={{ position: 'absolute', left: width * 0.04, top: height * 0.43, width: 84, height: 44, opacity: 0.45 }} resizeMode="contain" />
        <Image source={HOME_ART.cloudB} style={{ position: 'absolute', left: width * 0.78, top: height * 0.42, width: 100, height: 45, opacity: 0.45 }} resizeMode="contain" />
        <Image source={HOME_ART.starB} style={{ position: 'absolute', left: width * 0.2, top: height * 0.13, width: 20, height: 19 }} resizeMode="contain" />
        <Image source={HOME_ART.starC} style={{ position: 'absolute', left: width * 0.9, top: height * 0.08, width: 18, height: 17 }} resizeMode="contain" />
        <Image source={HOME_ART.starA} style={{ position: 'absolute', left: width * 0.58, top: height * 0.25, width: 14, height: 13 }} resizeMode="contain" />
      </View>
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
        <IconButton icon="note" art={HOME_ART.btnNote} size={60} label={t('a11y.songs')} caption={t('ui.songs')} onPress={onSongs} />
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: row, gap: 10 }}>
          <IconButton icon="help" art={HOME_ART.btnHelp} size={60} label={t('a11y.help')} caption={t('ui.help')} onPress={onHelp} badge={!progress.helpSeen} />
          <IconButton icon="gear" art={HOME_ART.btnGear} size={60} label={t('a11y.settings')} caption={t('ui.settings')} onPress={onSettings} />
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
                onPress={() => { hapticLight(); if (locked) onLocked(st.id); else onPick(st.id); }} />
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
  name: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 3 },
  pill: { position: 'absolute', justifyContent: 'center' },
  count: { backgroundColor: 'rgba(27,19,64,0.85)' },
  emblem: { position: 'absolute', top: 10, left: 10, width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(27,19,64,0.92)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  lock: { position: 'absolute', top: 8, right: 8, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(27,19,64,0.8)', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: -6, left: -6, borderWidth: 3, borderColor: COLORS.glow },
  listen: { position: 'absolute', right: 10, bottom: 10, backgroundColor: COLORS.ok, alignItems: 'center', justifyContent: 'center' }, // a locked world can be listened to first
  finger: { position: 'absolute', alignSelf: 'center', width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 4, borderColor: '#FFC857' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotOn: { backgroundColor: COLORS.glow },
  dotOff: { backgroundColor: 'rgba(255,255,255,0.18)' },
});
