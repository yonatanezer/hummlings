import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEngine } from '../audio';
import type { BarPlan } from '../core/engine';
import { barSec } from '../core/tuning';
import type { Stage } from '../core/types';
import { t } from '../i18n';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { StageCardArt } from './StageCardArt';
import { WorldIcon } from './WorldIcon';
import { COLORS } from './theme';
import { hapticLight } from './haptics';

const PREVIEW_BARS = 5;
/** One more singer joins each bar (first the loops that decode first), so ten seconds give the feel of the world. */
const PICKS = [0, 1, 2, 6, 7];

/**
 * A locked world is a preview, not a wall: the child can listen to it first (a short band that builds up). Only the padlock leads on, and that goes through the parental gate.
 * No words: the picture, a big play button, and the padlock.
 */
export function WorldPreview({ stage, onClose, onUnlock }: { stage: Stage; onClose: () => void; onUnlock: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const engine = useMemo(() => getEngine(), []);
  const [playing, setPlaying] = useState(false);
  const [bar, setBar] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const pulse = useSharedValue(0);
  const cw = Math.min(width * 0.36, 340), ch = Math.min(height * 0.62, cw * 0.95);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    engine.stop();
    if (alive.current) { setPlaying(false); setBar(0); }
    pulse.value = 0;
  };

  const play = async () => {
    hapticLight();
    if (playing) return stop();
    setPlaying(true);
    await engine.init();
    await engine.loadStage(stage, { background: true });
    if (!alive.current) return;
    const ids = PICKS.map((i) => stage.creatures[i]!.id);
    engine.start(stage.bpm, (b) => {
      if (alive.current) setBar(b);
      const plan: BarPlan = { ids: ids.slice(0, Math.min(ids.length, b + 1)), bonusFile: null, tick: 'off', gains: {}, fill: b === PREVIEW_BARS - 1 };
      return plan;
    });
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 300 })), -1);
    timer.current = setTimeout(stop, PREVIEW_BARS * barSec(stage.bpm) * 1000 + 300);
  };

  useEffect(() => () => { alive.current = false; if (timer.current) clearTimeout(timer.current); engine.stop(); }, [engine]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.18 }], opacity: 0.25 + pulse.value * 0.5 }));

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={[styles.close, { top: insets.top + 6, right: insets.right + 10 }]}><IconButton icon="close" label={t('a11y.close')} onPress={() => { stop(); onClose(); }} /></View>
      <View style={styles.row}>
        <View>
          <StageCardArt stage={stage} locked={false} width={cw} height={ch} />
          <View style={styles.emblem}><WorldIcon stageId={stage.id} size={44} /></View>
        </View>
        <View style={styles.side}>
          <View style={styles.playWrap}>
            <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
            <Pressable accessibilityRole="button" accessibilityLabel={t(playing ? 'a11y.pause' : 'a11y.play')} onPress={() => void play()} style={({ pressed }) => [styles.play, pressed && { transform: [{ scale: 0.94 }] }]}>
              <Icon name={playing ? 'stop' : 'play'} size={56} color="#10282A" />
            </Pressable>
          </View>
          <View style={styles.dots} accessible={false}>
            {PICKS.map((_, i) => <View key={i} style={[styles.dot, playing && i <= bar && styles.dotOn]} />)}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('unlock.title')} onPress={() => { stop(); onUnlock(); }} style={({ pressed }) => [styles.lock, pressed && { opacity: 0.8 }]}>
            <Icon name="lock" size={26} color="#FFE8A3" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,6,32,0.97)', alignItems: 'center', justifyContent: 'center', zIndex: 40 },
  close: { position: 'absolute', zIndex: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 44 },
  emblem: { position: 'absolute', top: 10, left: 10, width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(27,19,64,0.92)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  side: { alignItems: 'center', gap: 20 },
  playWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 132, height: 132, borderRadius: 66, backgroundColor: COLORS.ok },
  play: { width: 108, height: 108, borderRadius: 54, backgroundColor: COLORS.ok, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotOn: { backgroundColor: COLORS.glow },
  lock: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(27,19,64,0.96)', borderWidth: 2, borderColor: 'rgba(255,232,163,0.6)', alignItems: 'center', justifyContent: 'center' },
});
