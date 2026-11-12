import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { comboProgress } from '../core/combos';
import type { GoalId } from '../core/goals';
import { audibleIds } from '../core/stageState';
import type { IconName } from '../core/uiIcons';
import type { Session } from '../core/session';
import type { Stage } from '../core/types';
import { t } from '../i18n';
import { ComboCardArt } from '../ui/ComboCardArt';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { COLORS } from '../ui/theme';

interface Props {
  stage: Stage;
  session: Session;
  discovered: string[];
  onClose: () => void;
  onReplay: (comboId: string) => void;
}

/** One picture per goal sticker (the stickers are earned by playing; no words, so a child can read them). */
const GOAL_ICON: Record<GoalId, IconName> = { fullBand: 'goalBand', drumCircle: 'goalDrums', choir: 'goalChoir', fullStage: 'goalStage', soloist: 'goalSolo', mixMaster: 'goalMix', swapper: 'goalSwap', twoCombos: 'goalCombos' };

/** Combo book: 3 cards. Undiscovered = silhouette + 4 dots lighting up for creatures currently on stage (honest hint). */
export function ComboBook({ stage, session, discovered, onClose, onReplay }: Props) {
  const { width, height } = useWindowDimensions();
  const w = width * 0.8;
  const cardW = (w - 24 * 5) / stage.combos.length;
  const cardH = Math.min(height * 0.36, cardW * 0.75);
  const have = audibleIds(session.state); // singers on stage now: they show in colour on the cards
  const goals = session.goals.progress(session.state, session.discoveredInStage);
  const anyFound = stage.combos.some((c) => discovered.includes(c.id)); // room for the replay buttons only once there is something to replay
  return (
    <View style={styles.overlay} accessibilityLabel={t('combo.title')}>
      <View style={[styles.sheet, { width: w, maxHeight: height * 0.92 }]}>
        <View style={styles.close}><IconButton icon="close" label={t('a11y.close')} onPress={onClose} /></View>
        <View style={styles.row}>
          {stage.combos.map((combo) => {
            const found = discovered.includes(combo.id);
            const n = comboProgress(combo, session.state);
            return (
              <View key={combo.id} style={{ width: cardW, alignItems: 'center', gap: 12 }}>
                <ComboCardArt stage={stage} combo={combo} discovered={found} width={cardW} height={cardH} have={have} />
                <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel={`${n}/4`}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: found || i < n ? COLORS.glow : 'rgba(255,255,255,0.15)', width: 20, height: 20, borderRadius: 10 }]} />
                  ))}
                </View>
                {found ? <IconButton icon="play" label={t('a11y.play')} onPress={() => onReplay(combo.id)} /> : <View style={{ height: anyFound ? 56 : 0 }} />}
              </View>
            );
          })}
        </View>
        <View style={styles.shelf} accessibilityLabel={t('goals.title')}>
          {goals.map((g) => (
            <View key={g.id} style={styles.stickerCol} accessibilityLabel={`${g.n}/${g.total}`}>
              <View style={[styles.sticker, g.done && styles.stickerOn]}>
                <Icon name={GOAL_ICON[g.id]} size={26} color={g.done ? '#2A1F00' : 'rgba(255,255,255,0.5)'} />
                {g.done && <View style={styles.tick}><Icon name="check" size={12} color="#10282A" /></View>}
              </View>
              <View style={styles.pips}>
                {Array.from({ length: g.total }, (_, i) => <View key={i} style={[styles.pip, (g.done || i < g.n) && styles.pipOn]} />)}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,6,32,0.72)', alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: COLORS.panel, borderRadius: 28, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 24, justifyContent: 'center' },
  close: { position: 'absolute', top: 6, right: 6, zIndex: 3 }, // inside the corner, above the first row of cards
  row: { flexDirection: 'row', justifyContent: 'center', gap: 24, alignItems: 'flex-start' },
  dot: {},
  shelf: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  stickerCol: { alignItems: 'center', gap: 6 },
  sticker: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  stickerOn: { backgroundColor: COLORS.glow, borderColor: '#FFFFFF' },
  tick: { position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.ok, alignItems: 'center', justifyContent: 'center' },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  pipOn: { backgroundColor: COLORS.glow },
});
