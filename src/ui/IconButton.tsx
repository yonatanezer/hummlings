import { Pressable, StyleSheet, View } from 'react-native';
import { hapticLight } from './haptics';
import { Icon, type IconName } from './Icon';
import { COLORS, MIN_TOUCH } from './theme';

export function IconButton({ icon, label, onPress, color = COLORS.text, bg = 'rgba(27,19,64,0.72)', size = MIN_TOUCH, haptics = true, badge }: {
  icon: IconName; label: string; onPress: () => void; color?: string; bg?: string; size?: number; haptics?: boolean; badge?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={() => { if (haptics) hapticLight(); onPress(); }}
      style={({ pressed }) => [styles.btn, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
    >
      <Icon name={icon} color={color} size={size * 0.5} />
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  badge: { position: 'absolute', top: 8, right: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.rec },
});
