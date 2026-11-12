import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS } from './theme';

/** An on/off switch in the app's own look: a roomy pill (64 x 40) whose knob and colour both change, so it reads without text. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => onChange(!value)} hitSlop={6}
      style={[styles.track, value ? styles.on : styles.off]}>
      <View style={[styles.knob, value ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  track: { width: 68, height: 40, borderRadius: 20, padding: 4, justifyContent: 'center', borderWidth: 2 },
  on: { backgroundColor: COLORS.ok, borderColor: '#FFFFFF' },
  off: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.3)' },
  knob: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF' },
});
