import { StyleSheet, View } from 'react-native';
import type { Stage } from '../core/types';
import { LAYER_COLORS, LAYERS, type Layer } from '../core/types';
import { hudModel } from '../core/hud';
import type { StageState } from '../core/stageState';
import { Icon, type IconName } from './Icon';

const GLYPH: Record<Layer, IconName> = { drums: 'goalDrums', bass: 'motion', melody: 'note', voice: 'mic' };
const PILL = 'rgba(27,19,64,0.94)';
const OFF = 'rgba(255,255,255,0.14)';

/** Two read-only pills on the top bar: which kinds of singer are playing, and how close the nearest secret combo is. Pictures only, no words. */
export function StageHud({ stage, state, discovered, compact, row }: { stage: Stage; state: StageState; discovered: readonly string[]; compact: boolean; row: 'row' | 'row-reverse' }) {
  const m = hudModel(stage, state, discovered);
  const d = compact ? 30 : 32;
  return (
    <View pointerEvents="none" style={[styles.wrap, { flexDirection: row }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.pill, { flexDirection: row }]}>
        {LAYERS.map((l) => (
          <View key={l} style={[styles.dot, { width: d, height: d, borderRadius: d / 2, backgroundColor: m.layers[l] ? LAYER_COLORS[l] : OFF }]}>
            <Icon name={GLYPH[l]} size={d * 0.6} color={m.layers[l] ? '#1B1340' : '#8F86C8'} />
          </View>
        ))}
      </View>
      {!compact && (
        <View style={[styles.pill, { flexDirection: row }]}>
          {m.best && (
            <View style={{ flexDirection: row, gap: 4 }}>
              {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.cdot, i < m.best!.have && { backgroundColor: '#FFC857' }]} />)}
            </View>
          )}
          <View style={{ flexDirection: row, gap: 0 }}>
            {Array.from({ length: m.total }, (_, i) => <Icon key={i} name="star" size={18} color={i < m.found ? '#FFE066' : 'rgba(255,255,255,0.22)'} />)}
          </View>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  pill: { alignItems: 'center', gap: 6, height: 46, paddingHorizontal: 8, borderRadius: 26, backgroundColor: PILL, borderWidth: 2, borderColor: 'rgba(255,255,255,0.28)' },
  dot: { alignItems: 'center', justifyContent: 'center' },
  cdot: { width: 13, height: 13, borderRadius: 7, backgroundColor: OFF },
});
