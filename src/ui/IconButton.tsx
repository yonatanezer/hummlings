import { createContext, useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { hapticLight } from './haptics';
import { useLang } from '../i18n/useLang';
import { Icon, type IconName } from './Icon';
import { COLORS, MIN_TOUCH } from './theme';

/** The accent colour of the world being played: it tints the border of every button on the stage, so each world feels like its own place. */
export const AccentContext = createContext<string | null>(null);

export function IconButton({ icon, label, onPress, color = COLORS.text, bg = 'rgba(27,19,64,0.96)', size = MIN_TOUCH, haptics = true, badge, caption, primary }: {
  icon: IconName; label: string; onPress: () => void; color?: string; bg?: string; size?: number; haptics?: boolean; badge?: boolean; caption?: string; primary?: boolean; // primary: the one button that matters most on the screen
}) {
  const { rtl } = useLang();
  const accent = useContext(AccentContext);
  const border = primary ? COLORS.rec : accent && /^#[0-9a-f]{6}$/i.test(accent) ? `${accent}99` : 'rgba(255,255,255,0.4)';
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={() => { if (haptics) hapticLight(); onPress(); }}
      style={({ pressed }) => [styles.btn, { width: size, height: size, borderRadius: size / 2, backgroundColor: pressed ? COLORS.panelLight : bg, borderColor: border, borderWidth: primary ? 3.5 : 2, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
    >
      <Icon name={icon} color={color} size={size * 0.6} mirror={rtl && (icon === 'back' || icon === 'next')} />
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
  if (!caption) return button;
  return (
    <View style={styles.wrap}>
      {button}
      <Text style={[styles.caption, { maxWidth: size + 28 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 3 },
  caption: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 4 },
  btn: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.rec, borderWidth: 2, borderColor: '#fff' },
});
