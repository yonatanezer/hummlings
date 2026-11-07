import { Pressable, StyleSheet, Text, View } from 'react-native';
import { hapticLight } from './haptics';
import { Icon, type IconName } from './Icon';
import { COLORS, MIN_TOUCH } from './theme';

export function IconButton({ icon, label, onPress, color = COLORS.text, bg = 'rgba(27,19,64,0.96)', size = MIN_TOUCH, haptics = true, badge, caption }: {
  icon: IconName; label: string; onPress: () => void; color?: string; bg?: string; size?: number; haptics?: boolean; badge?: boolean; caption?: string;
}) {
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={() => { if (haptics) hapticLight(); onPress(); }}
      style={({ pressed }) => [styles.btn, { width: size, height: size, borderRadius: size / 2, backgroundColor: pressed ? COLORS.panelLight : bg, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
    >
      <Icon name={icon} color={color} size={size * 0.52} />
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
  if (!caption) return button;
  return (
    <View style={styles.wrap}>
      {button}
      <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 3 },
  caption: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 4 },
  btn: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  badge: { position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.rec, borderWidth: 2, borderColor: '#fff' },
});
