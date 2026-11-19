import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { lessonSteps, lessonTotalCoins, type LessonLevel } from '../core/lesson';
import { t } from '../i18n';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { COLORS } from './theme';
import { hapticLight } from './haptics';

/** Something that pops in (a little spring) after a delay. */
function PopIn({ delay, children, spring = true }: { delay: number; children: ReactNode; spring?: boolean }) {
  const k = useSharedValue(0);
  useEffect(() => { k.value = withDelay(delay, spring ? withSpring(1, { damping: 7, stiffness: 160 }) : withTiming(1, { duration: 300 })); }, [delay, k, spring]);
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, k.value * 2), transform: [{ scale: spring ? 0.3 + 0.7 * k.value : 1 }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

/** A gold coin: a disc with a star. */
function Coin({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFC857', borderWidth: Math.max(2, size * 0.08), borderColor: '#B8741A', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="star" size={size * 0.6} color="#FFF3C4" />
    </View>
  );
}

/** The success card of a level: three stars pop in, the coins add up, then a big continue button. No reading needed (the title is for those who can). */
export function LessonDone({ level = 1, onNext }: { level?: LessonLevel; onNext: () => void }) {
  const { height } = useWindowDimensions();
  const compact = height < 380;
  const total = lessonTotalCoins(level);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let alive = true;
    const t0 = Date.now() + 900;
    const id = setInterval(() => {
      if (!alive) return;
      const k = Math.min(1, Math.max(0, (Date.now() - t0) / 1200));
      setShown(Math.round(total * k));
      if (k >= 1) clearInterval(id);
    }, 40);
    return () => { alive = false; clearInterval(id); };
  }, [total]);
  const star = compact ? 46 : 62;
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={[styles.card, compact && { padding: 14, gap: 8 }]}>
        <PopIn delay={80}><Text style={[styles.title, compact && { fontSize: 22 }]} accessibilityRole="header">{t('lesson.done')}</Text></PopIn>
        <View style={styles.row}>
          {Array.from({ length: 3 }, (_, i) => (
            <PopIn key={i} delay={350 + i * 260}><Icon name="star" size={star * (i === 1 ? 1.25 : 1)} color="#FFC857" /></PopIn>
          ))}
        </View>
        <PopIn delay={900} spring={false}>
          <View style={styles.row} accessible accessibilityLabel={`${total}`}>
            {Array.from({ length: lessonSteps(level) }, (_, i) => <Coin key={i} size={compact ? 26 : 32} />)}
            <Text style={[styles.count, compact && { fontSize: 26 }]}>{`+${shown}`}</Text>
          </View>
        </PopIn>
        <PopIn delay={1900}><IconButton primary icon="next" label={t('a11y.lessonNext')} size={compact ? 70 : 84} onPress={() => { hapticLight(); onNext(); }} /></PopIn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,6,32,0.62)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: COLORS.panel, paddingHorizontal: 30, paddingVertical: 20, borderRadius: 28, alignItems: 'center', gap: 12, borderWidth: 3, borderColor: '#FFC857' },
  title: { color: COLORS.glow, fontSize: 28, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  count: { color: '#FFE066', fontSize: 32, fontWeight: '900', marginStart: 8, minWidth: 64 },
});
