import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEngine } from '../audio';
import { useProgress } from '../app/progress';
import { t } from '../i18n';
import { drawHomeBackdrop } from '../ui/draw/home';
import { FALL_MS, HERO_COUNT, HERO_NOTES, heroGeometry, paddedGeo, type HeroHit } from '../ui/draw/hero';
import { HeroCanvas } from '../ui/HeroCanvas';
import { HomeTitle, TITLE_SIDE } from '../ui/HomeTitle';
import { COLORS } from '../ui/theme';

const GAP_MS = 300; // one singer lands every 300 ms (about 100 bpm), each on a note of the scale
const TAIL_MS = 750; // how long the finished picture stays before the home screen takes over
const INIT_WAIT_MS = 700; // longest wait for the audio engine before starting without sound

/**
 * Intro: the singers drop onto the hill one after another, each landing is a note of a rising scale and pops the next letters of the title in.
 * They land exactly where they stand on the home screen, so the intro turns into the home screen without a cut. A tap skips it.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { progress } = useProgress();
  const still = progress.settings.reduceMotion;
  const topBarH = insets.top + 6 + 84;
  const geo = useMemo(() => heroGeometry(width, height, topBarH, insets.left, insets.right), [width, height, topBarH, insets.left, insets.right]);
  const hits = useSharedValue<HeroHit[]>([]);
  const introStart = useSharedValue(-1);
  const clock = useSharedValue(0);
  const reveal = useSharedValue(still ? 99 : 0);
  const pulse = useSharedValue(0);
  const doneRef = useRef(false);
  const finish = () => { if (!doneRef.current) { doneRef.current = true; onDone(); } };

  // Recorded on the UI runtime (as the old splash did): a picture built during the very first render came out blank on the phone.
  const backdrop = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawHomeBackdrop(Skia, canvas, width, height);
    return rec.finishRecordingAsPicture();
  });
  // The hill runs on to the bottom of the screen (the home screen puts the world cards on it).
  const padded = useMemo(() => paddedGeo(geo, height - geo.top), [geo, height]);

  useEffect(() => {
    if (still) { const id = setTimeout(finish, 700); return () => clearTimeout(id); }
    const engine = getEngine();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let alive = true;
    const ready = Promise.race([
      engine.init().then(() => { engine.setVolume(progress.settings.musicVolume); engine.stop(); return true; }).catch(() => false),
      new Promise<boolean>((r) => setTimeout(() => r(false), INIT_WAIT_MS)),
    ]);
    void ready.then((initOk) => {
      const hasSound = initOk && progress.settings.introSound;
      if (!alive) return;
      introStart.value = clock.value + 60;
      const letters = Array.from(t('app.name')).length;
      for (let i = 0; i < HERO_COUNT; i++) {
        timers.push(setTimeout(() => {
          if (hasSound) engine.playSfx('pop', HERO_NOTES[i]!);
          pulse.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 260 }));
          reveal.value = withTiming(i === HERO_COUNT - 1 ? letters : ((i + 1) * letters) / HERO_COUNT, { duration: 160 });
        }, 60 + FALL_MS + i * GAP_MS));
      }
      const end = 60 + FALL_MS + (HERO_COUNT - 1) * GAP_MS;
      timers.push(setTimeout(() => {
        if (hasSound) engine.playSfx('goal');
        pulse.value = withSequence(withTiming(1.4, { duration: 100 }), withTiming(0, { duration: 420 }));
      }, end + 330));
      timers.push(setTimeout(finish, end + TAIL_MS));
    });
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, []);

  return (
    <Pressable style={styles.root} onPress={finish} accessibilityRole="button" accessibilityLabel={t('app.name')}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none"><Picture picture={backdrop} /></Canvas>
      <View style={[styles.title, { top: insets.top + 6, left: insets.left + TITLE_SIDE, right: insets.right + TITLE_SIDE }]} pointerEvents="none">
        <HomeTitle title={t('app.name')} subtitle={t('app.subtitle')} reveal={reveal} pulse={pulse} />
      </View>
      <View style={{ position: 'absolute', top: geo.top - padded.pad, left: 0 }} pointerEvents="none">
        <HeroCanvas geo={padded.geo} width={width} hits={hits} introStart={introStart} gap={GAP_MS} still={still} clock={clock} />
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky },
  title: { position: 'absolute', alignItems: 'center' },
});
