import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { COLORS } from './theme';
import { HOME_ART } from './homeArt';

/** Space kept clear on each side of the title for the corner buttons (the two on the left are the widest group). */
export const TITLE_SIDE = 140;

const Letter = ({ ch, k, reveal, size }: { ch: string; k: number; reveal: SharedValue<number>; size: number }) => {
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, reveal.value - k));
    return { opacity: p, transform: [{ translateY: (1 - p) * -size * 0.7 }, { scale: 0.5 + 0.5 * p }] };
  });
  return <Animated.Text style={[styles.letter, { fontSize: size }, style]}>{ch}</Animated.Text>;
};

/**
 * The wordmark. With `reveal` (a number of letters, 0..N) the letters pop in one by one (the intro); without it the title is simply there.
 * `pulse` (0..1) swells the whole mark, kicked by every note a singer sings.
 */
export function HomeTitle({ title, subtitle, reveal, pulse }: { title: string; subtitle: string; reveal?: SharedValue<number>; pulse: SharedValue<number> }) {
  const size = 38;
  const logoH = 92;
  const chars = Array.from(title);
  const box = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.14 }] }));
  const sub = useAnimatedStyle(() => ({ opacity: reveal ? Math.min(1, Math.max(0, (reveal.value - (chars.length - 0.7)) * 2.5)) : 1 }));
  if (!reveal) {
    // the painted wordmark; its ribbon is empty, the tagline is written on it in the player's language
    const logoW = logoH * (560 / 195);
    return (
      <View style={styles.box} pointerEvents="none">
        <Animated.View style={[{ width: logoW, height: logoH }, box]} accessibilityRole="header" accessible accessibilityLabel={title}>
          <Image source={HOME_ART.logo} style={{ width: logoW, height: logoH }} resizeMode="contain" />
          <View style={{ position: 'absolute', left: logoW * 0.17, right: logoW * 0.17, top: logoH * 0.69, height: logoH * 0.17, justifyContent: 'center' }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.ribbon}>{subtitle}</Text>
          </View>
        </Animated.View>
      </View>
    );
  }
  return (
    <View style={styles.box} pointerEvents="none">
      <Animated.View style={[{ flexDirection: 'row' }, box]} accessibilityRole="header" accessible accessibilityLabel={title}>
        {chars.map((ch, i) => (reveal ? <Letter key={i} ch={ch} k={i} reveal={reveal} size={size} /> : <Text key={i} style={[styles.letter, { fontSize: size }]}>{ch}</Text>))}
      </Animated.View>
      <Animated.Text style={[styles.sub, sub]} numberOfLines={1} adjustsFontSizeToFit>{subtitle}</Animated.Text>
    </View>
  );
}
const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', paddingTop: 2, paddingHorizontal: 8 },
  letter: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 1, textShadowColor: '#FF7AA8', textShadowRadius: 14 },
  ribbon: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  sub: { color: COLORS.textDim, fontSize: 14, fontWeight: '600', maxWidth: '100%' },
});
