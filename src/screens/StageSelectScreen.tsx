import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STAGES, FREE_STAGE_IDS } from '../content';
import { t, type StringKey } from '../i18n';
import { useLang } from '../i18n/useLang';
import { useProgress } from '../app/progress';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { StageCardArt } from '../ui/StageCardArt';
import { WorldIcon } from '../ui/WorldIcon';
import { COLORS } from '../ui/theme';
import { hapticLight } from '../ui/haptics';

export function StageSelectScreen({ onPick, onLocked, onSettings, onSongs, onHelp }: { onPick: (id: string) => void; onLocked: () => void; onSettings: () => void; onSongs: () => void; onHelp: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { rtl } = useLang();
  const { progress } = useProgress();
  const cardW = Math.min(width * 0.28, 320);
  const cardH = Math.min(height * 0.62, cardW * 1.1);
  const row = rtl ? 'row-reverse' : 'row';
  return (
    <View style={styles.root}>
      <View style={[styles.top, { top: insets.top + 6, left: insets.left + 10, right: insets.right + 10, flexDirection: row }]}>
        <IconButton icon="note" label={t('a11y.songs')} caption={t('ui.songs')} onPress={onSongs} />
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: row, gap: 10 }}>
        <IconButton icon="help" label={t('a11y.help')} caption={t('ui.help')} onPress={onHelp} badge={!progress.helpSeen} />
        <IconButton icon="gear" label={t('a11y.settings')} caption={t('ui.settings')} onPress={onSettings} />
        </View>
      </View>
      <View style={[styles.cards, { flexDirection: 'row' }]}>
        {STAGES.map((st) => {
          const locked = !FREE_STAGE_IDS.includes(st.id) && !progress.unlocked;
          const found = st.combos.filter((c) => progress.discoveredCombos.includes(c.id)).length;
          return (
            <Pressable key={st.id} accessibilityRole="button" accessibilityLabel={`${t(st.nameKey as StringKey)}${locked ? ', ' + t('select.locked') : ''}`}
              onPress={() => { hapticLight(); (locked ? onLocked : () => onPick(st.id))(); }} style={({ pressed }) => [{ width: cardW, alignItems: 'center', gap: 10, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
              <View>
                <StageCardArt stage={st} locked={locked} width={cardW} height={cardH} />
                <View style={styles.emblem}><WorldIcon stageId={st.id} size={40} /></View>
                {locked && <View style={styles.lock}><Icon name="lock" size={28} color="#FFE8A3" /></View>}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><WorldIcon stageId={st.id} size={28} /><Text style={styles.name}>{t(st.nameKey as StringKey)}</Text></View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {st.combos.map((c, i) => <View key={c.id} style={[styles.dot, { backgroundColor: i < found ? COLORS.glow : 'rgba(255,255,255,0.18)' }]} />)}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky, justifyContent: 'center' },
  top: { position: 'absolute', alignItems: 'center', zIndex: 2 },
  cards: { justifyContent: 'center', gap: 24, alignItems: 'flex-start' },
  name: { color: '#fff', fontSize: 22, fontWeight: '700' },
  emblem: { position: 'absolute', top: 10, left: 10, width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(27,19,64,0.92)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  lock: { position: 'absolute', top: 10, right: 10, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(27,19,64,0.8)', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
