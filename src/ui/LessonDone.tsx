import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { LESSON_LEVELS, lessonSteps, lessonTotalCoins, type LessonLevel } from '../core/lesson';
import { doneCoinRow, doneLayout, introLayout } from '../core/levelscreens';
import { t } from '../i18n';
import { hapticLight } from './haptics';

/**
 * The success card of a level. The art (rays, confetti, the card and its ribbon, three stars that pop in, coins, the big button) is drawn by the scene from `sv.screen`;
 * this layer has the ribbon's title, the "+N" that counts up, and the button, on the same rectangles (core/levelscreens.ts). No reading is needed (the title is for those who can).
 */
export function LessonDone({ level = 1, onNext }: { level?: LessonLevel; onNext: () => void }) {
  const { width, height } = useWindowDimensions();
  const D = doneLayout(width, height);
  const total = lessonTotalCoins(level), steps = lessonSteps(level);
  const last = level === LESSON_LEVELS[LESSON_LEVELS.length - 1];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let alive = true;
    const t0 = Date.now() + 950;
    const id = setInterval(() => {
      if (!alive) return;
      const k = Math.min(1, Math.max(0, (Date.now() - t0) / 1100));
      setShown(Math.round(total * k));
      if (k >= 1) clearInterval(id);
    }, 40);
    return () => { alive = false; clearInterval(id); };
  }, [total]);
  const k = useSharedValue(0);
  useEffect(() => { k.value = withDelay(1900, withSpring(1, { damping: 9, stiffness: 140 })); }, [k]);
  const btn = useAnimatedStyle(() => ({ opacity: k.value > 0.05 ? 1 : 0 }));
  const row = doneCoinRow(D.card, D.countX, D.u, steps);
  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <View pointerEvents="none" style={{ position: 'absolute', left: D.ribbon.x, top: D.ribbon.y, width: D.ribbon.w, height: D.ribbon.h, alignItems: 'center', justifyContent: 'center' }}>
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={[styles.title, { fontSize: 24 * D.u }]}>{t(last ? 'lesson.final' : 'lesson.done')}</Text>
      </View>
      <View accessible accessibilityLabel={`${total}`} pointerEvents="none" style={{ position: 'absolute', left: row.endX, top: D.coinsY - 22 * D.u, height: 44 * D.u, justifyContent: 'center' }}>
        <Text style={[styles.count, { fontSize: 30 * D.u }]}>{`+${shown}`}</Text>
      </View>
      <Animated.View style={[{ position: 'absolute', left: D.button.x - D.button.r * 1.3, top: D.button.y - D.button.r * 1.3, width: D.button.r * 2.6, height: D.button.r * 2.6 }, btn]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t(last ? 'a11y.freePlay' : 'a11y.lessonNext')} style={StyleSheet.absoluteFill} onPress={() => { hapticLight(); onNext(); }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: '#FFFFFF', fontWeight: '900', textShadowColor: 'rgba(120,20,60,0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
  count: { color: '#FFE066', fontWeight: '900', minWidth: 70, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
});

/** The level's name on its banner (the banner is drawn by the scene): it drops in with the banner, waits, and floats away with it. */
export function LevelIntro({ level, stageH }: { level: number; stageH: number }) {
  const { width } = useWindowDimensions();
  const B = introLayout(width, stageH);
  const k = useSharedValue(0), out = useSharedValue(0);
  useEffect(() => {
    k.value = withSpring(1, { damping: 9, stiffness: 150 });
    out.value = withDelay(1900, withTiming(1, { duration: 600 }));
  }, [k, out]);
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, k.value * 3) * (1 - out.value), transform: [{ translateY: (1 - k.value) * -B.h * 1.4 - out.value * 24 }, { scale: 0.7 + 0.3 * k.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: B.x, top: B.y, width: B.w, height: B.h, alignItems: 'center', justifyContent: 'center' }, st]}>
      <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={{ color: '#FFFFFF', fontWeight: '900', fontSize: B.h * 0.5, textShadowColor: 'rgba(30,10,90,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 }}>{t('a11y.level', { n: level })}</Text>
    </Animated.View>
  );
}
