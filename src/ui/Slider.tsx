import { useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import { COLORS } from './theme';

/** Minimal accessible slider (0..1). */
export function Slider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [w, setW] = useState(1);
  const set = (e: GestureResponderEvent) => onChange(Math.min(1, Math.max(0, e.nativeEvent.locationX / w)));
  return (
    <View
      accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.min(1, Math.max(0, value + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true} onResponderGrant={set} onResponderMove={set}
      style={{ height: 56, justifyContent: 'center', flex: 1 }}
    >
      <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.18)' }}>
        <View style={{ width: `${value * 100}%`, height: 10, borderRadius: 5, backgroundColor: COLORS.glow }} />
      </View>
      <View style={{ position: 'absolute', left: `${value * 100}%`, marginLeft: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff' }} />
    </View>
  );
}
