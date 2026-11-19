import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { mapLayout } from '../core/levelscreens';
import type { LevelState } from '../core/lesson';
import { t } from '../i18n';
import { useLang } from '../i18n/useLang';
import { hapticLight } from './haptics';

/** The number of a circle pops in with it (the circle itself is drawn by the scene). */
function PopIn({ delay, children }: { delay: number; children: ReactNode }) {
  const k = useSharedValue(0);
  useEffect(() => { k.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 150 })); }, [delay, k]);
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, k.value * 2), transform: [{ scale: 0.3 + 0.7 * k.value }] }));
  return <Animated.View style={st} pointerEvents="none">{children}</Animated.View>;
}

/**
 * The map of a world's levels. The art (night pond, rope, glossy circles, the walking hummling) is drawn by the scene from `sv.screen`; this layer only holds the touch targets,
 * the numbers and the coin count, on the same rectangles (core/levelscreens.ts). Numbers and pictures only, so a child who cannot read can still follow it.
 */
export function LevelMap({ levels, coins, onPick, onFree, onBack }: {
  levels: { level: number; state: LevelState }[]; coins: number;
  onPick: (level: number) => void; onFree: () => void; onBack: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const { rtl } = useLang();
  const L = mapLayout(width, height, levels.length, rtl);
  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal accessibilityLabel={t('a11y.levelMap')} pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.back')} hitSlop={12} onPress={() => { hapticLight(); onBack(); }}
        style={{ position: 'absolute', left: L.back.x - 28, top: L.back.y - 28, width: 56, height: 56 }} />
      <View accessible accessibilityLabel={`${coins}`} pointerEvents="none" style={{ position: 'absolute', left: L.coins.x + 44, top: L.coins.y, width: L.coins.w - 56, height: L.coins.h, justifyContent: 'center' }}>
        <Text style={styles.coinText}>{coins}</Text>
      </View>
      {levels.map((lv, i) => {
        const p = L.nodes[i]!, locked = lv.state === 'locked';
        return (
          <Pressable key={lv.level} accessibilityRole="button" accessibilityLabel={`${t('a11y.level', { n: lv.level })}${locked ? ', ' + t('select.locked') : ''}`} accessibilityState={{ disabled: locked }} hitSlop={6}
            onPress={() => { if (locked) return; hapticLight(); onPick(lv.level); }}
            style={{ position: 'absolute', left: p.x - p.r * 1.1, top: p.y - p.r * 1.1, width: p.r * 2.2, height: p.r * 2.2, alignItems: 'center', justifyContent: 'center' }}>
            {locked ? null : <PopIn delay={150 + i * 120}><Text style={[styles.num, { fontSize: p.r * 0.98, lineHeight: p.r * 1.2 }]}>{lv.level}</Text></PopIn>}
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.freePlay')} hitSlop={6} onPress={() => { hapticLight(); onFree(); }}
        style={{ position: 'absolute', left: L.free.x - L.free.r * 1.1, top: L.free.y - L.free.r * 1.1, width: L.free.r * 2.2, height: L.free.r * 2.2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  coinText: { color: '#FFE066', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  num: { color: '#4A2B00', fontWeight: '900', textShadowColor: 'rgba(255,255,255,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
});
