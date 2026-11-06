import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { comboProgress } from '../core/combos';
import type { Session } from '../core/session';
import type { Stage } from '../core/types';
import { t } from '../i18n';
import { ComboCardArt } from '../ui/ComboCardArt';
import { IconButton } from '../ui/IconButton';
import { COLORS } from '../ui/theme';

interface Props {
  stage: Stage;
  session: Session;
  discovered: string[];
  onClose: () => void;
  onReplay: (comboId: string) => void;
}

/** Combo book: 3 cards. Undiscovered = silhouette + 4 dots lighting up for creatures currently on stage (honest hint). */
export function ComboBook({ stage, session, discovered, onClose, onReplay }: Props) {
  const { width, height } = useWindowDimensions();
  const w = width * 0.8;
  const cardW = (w - 24 * 5) / stage.combos.length;
  const cardH = Math.min(height * 0.5, cardW * 0.75);
  return (
    <View style={styles.overlay} accessibilityLabel={t('combo.title')}>
      <View style={[styles.sheet, { width: w, height: height * 0.8 }]}>
        <View style={styles.close}><IconButton icon="close" label={t('a11y.close')} onPress={onClose} /></View>
        <View style={styles.row}>
          {stage.combos.map((combo) => {
            const found = discovered.includes(combo.id);
            const n = comboProgress(combo, session.state);
            return (
              <View key={combo.id} style={{ width: cardW, alignItems: 'center', gap: 12 }}>
                <ComboCardArt stage={stage} combo={combo} discovered={found} width={cardW} height={cardH} />
                <View style={{ flexDirection: 'row', gap: 12 }} accessibilityLabel={`${n}/4`}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: found || i < n ? COLORS.glow : 'rgba(255,255,255,0.15)', width: 28, height: 28, borderRadius: 14 }]} />
                  ))}
                </View>
                {found ? <IconButton icon="play" label={t('a11y.play')} onPress={() => onReplay(combo.id)} /> : <View style={{ height: 56 }} />}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,6,32,0.72)', alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: COLORS.panel, borderRadius: 28, padding: 24, justifyContent: 'center' },
  close: { position: 'absolute', top: 12, right: 12 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 24, alignItems: 'flex-start' },
  dot: {},
});
