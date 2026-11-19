import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LevelState } from '../core/lesson';
import { t } from '../i18n';
import { useLang } from '../i18n/useLang';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { hapticLight } from './haptics';

/** A node that pops in (a little spring) after a delay. */
function PopIn({ delay, children }: { delay: number; children: ReactNode }) {
  const k = useSharedValue(0);
  useEffect(() => { k.value = withDelay(delay, withSpring(1, { damping: 8, stiffness: 150 })); }, [delay, k]);
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, k.value * 2), transform: [{ scale: 0.3 + 0.7 * k.value }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

/** The level that waits: its ring breathes. */
function Pulse({ on, size, children }: { on: boolean; size: number; children: ReactNode }) {
  const k = useSharedValue(0);
  useEffect(() => {
    if (on) k.value = withRepeat(withSequence(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 650, easing: Easing.inOut(Easing.quad) })), -1);
    else { cancelAnimation(k); k.value = 0; }
    return () => cancelAnimation(k);
  }, [on, k]);
  const ring = useAnimatedStyle(() => ({ opacity: on ? 0.35 + 0.65 * k.value : 0, transform: [{ scale: 1 + 0.18 * k.value }] }));
  const body = useAnimatedStyle(() => ({ transform: [{ scale: on ? 1 + 0.05 * k.value : 1 }] }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -6, top: -6, width: size + 12, height: size + 12, borderRadius: (size + 12) / 2, borderWidth: 4, borderColor: '#FFE066' }, ring]} />
      <Animated.View style={body}>{children}</Animated.View>
    </View>
  );
}

/**
 * The map of a world's levels: a path of circles. Gold = finished (tap to play it again), the glowing one is next, dark ones are not open yet; the last circle is free play.
 * Numbers and pictures only, so a child who cannot read can still follow it.
 */
export function LevelMap({ levels, coins, onPick, onFree, onBack }: {
  levels: { level: number; state: LevelState }[]; coins: number;
  onPick: (level: number) => void; onFree: () => void; onBack: () => void;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { rtl } = useLang();
  const size = height < 380 ? 64 : 80;
  const row = rtl ? 'row-reverse' : 'row';
  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityLabel={t('a11y.levelMap')}>
      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 6, left: insets.left + 10, right: insets.right + 10, flexDirection: row }]}>
        <IconButton icon="back" label={t('a11y.back')} onPress={onBack} />
        <View style={[styles.coins, { flexDirection: row }]} accessible accessibilityLabel={`${coins}`}>
          <View style={styles.coin}><Icon name="star" size={18} color="#FFF3C4" /></View>
          <Text style={styles.coinText}>{coins}</Text>
        </View>
        <View style={{ width: 56 }} />
      </View>
      <View style={[styles.path, { flexDirection: row }]}>
        {levels.map((lv, i) => {
          const locked = lv.state === 'locked', done = lv.state === 'done';
          return (
            <View key={lv.level} style={{ flexDirection: row, alignItems: 'center' }}>
              <PopIn delay={150 + i * 140}>
                <Pulse on={lv.state === 'current'} size={size}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${t('a11y.level', { n: lv.level })}${locked ? ', ' + t('select.locked') : ''}`} accessibilityState={{ disabled: locked }} hitSlop={8}
                    onPress={() => { if (locked) return; hapticLight(); onPick(lv.level); }}
                    style={({ pressed }) => [styles.node, { width: size, height: size, borderRadius: size / 2, backgroundColor: locked ? 'rgba(255,255,255,0.12)' : done ? '#FFC857' : '#FFE8A3', borderColor: locked ? 'rgba(255,255,255,0.3)' : '#B8741A', transform: [{ scale: pressed && !locked ? 0.93 : 1 }] }]}>
                    {locked ? <Icon name="lock" size={size * 0.42} color="#FFFFFF" /> : <Text style={[styles.num, { fontSize: size * 0.46 }]}>{lv.level}</Text>}
                    {done ? <View style={styles.badge}><Icon name="check" size={16} color="#10282A" /></View> : null}
                  </Pressable>
                </Pulse>
              </PopIn>
              <View style={[styles.link, { backgroundColor: done ? '#FFC857' : 'rgba(255,255,255,0.22)' }]} />
            </View>
          );
        })}
        <PopIn delay={150 + levels.length * 140}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.freePlay')} hitSlop={8} onPress={() => { hapticLight(); onFree(); }}
            style={({ pressed }) => [styles.node, { width: size, height: size, borderRadius: size / 2, backgroundColor: '#5FE3C0', borderColor: '#1E8F72', transform: [{ scale: pressed ? 0.93 : 1 }] }]}>
            <Icon name="play" size={size * 0.5} color="#10282A" mirror={rtl} />
          </Pressable>
        </PopIn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,6,32,0.78)', alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', alignItems: 'center', justifyContent: 'space-between' },
  coins: { alignItems: 'center', gap: 8, backgroundColor: 'rgba(27,19,64,0.92)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 2, borderColor: '#FFC857' },
  coin: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFC857', borderWidth: 2, borderColor: '#B8741A', alignItems: 'center', justifyContent: 'center' },
  coinText: { color: '#FFE066', fontSize: 24, fontWeight: '900' },
  path: { alignItems: 'center' },
  node: { alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  num: { color: '#3A2400', fontWeight: '900' },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: '#5FE3C0', borderWidth: 2, borderColor: '#10282A', alignItems: 'center', justifyContent: 'center' },
  link: { width: 30, height: 7, borderRadius: 4, marginHorizontal: 4 },
});

