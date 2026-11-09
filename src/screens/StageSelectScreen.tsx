import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
  // The buttons float above the cards, so the cards are centred in the space below them (not under them), and sized to fit one row when they can.
  const topBarH = insets.top + 6 + 84;
  const GAP = 14;
  // Measured width of the area the cards live in (the window width also counts the system bar, which pushed the row off-centre).
  const [areaW, setAreaW] = useState(0);
  // Centred on what the eye sees: the camera cut-out (left inset) and the navigation bar (right inset) both eat space, so the left inset is mirrored on the right.
  const availW = (areaW || width) - insets.left * 2 - insets.right - 32;
  const fitW = (availW - GAP * (STAGES.length - 1)) / STAGES.length;
  const cardW = Math.min(Math.max(fitW, 120), 260);
  const cardH = Math.min((height - topBarH - 70) * 0.9, cardW * 1.1);
  const row = rtl ? 'row-reverse' : 'row';
  const fits = STAGES.length * cardW + (STAGES.length - 1) * GAP <= availW;
  const Wrap: any = fits ? View : ScrollView;
  const wrapProps: any = fits
    ? { style: { flexDirection: row, justifyContent: 'center', alignItems: 'flex-start', gap: GAP } }
    : { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: [styles.cards, { flexDirection: row, paddingHorizontal: 16, gap: GAP }] };
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
      <View style={{ alignSelf: 'stretch', marginTop: topBarH, paddingLeft: insets.left + 16, paddingRight: insets.left + insets.right + 16 }} onLayout={(e) => setAreaW(e.nativeEvent.layout.width)}>
      <Wrap {...wrapProps}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, maxWidth: cardW }}><WorldIcon stageId={st.id} size={24} /><Text numberOfLines={2} style={[styles.name, { fontSize: Math.min(22, cardW * 0.13), flexShrink: 1, textAlign: 'center' }]}>{t(st.nameKey as StringKey)}</Text></View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {st.combos.map((c, i) => <View key={c.id} style={[styles.dot, { backgroundColor: i < found ? COLORS.glow : 'rgba(255,255,255,0.18)' }]} />)}
              </View>
            </Pressable>
          );
        })}
      </Wrap>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky, justifyContent: 'center' },
  top: { position: 'absolute', alignItems: 'center', zIndex: 2 },
  cards: { justifyContent: 'center', alignItems: 'flex-start' },
  name: { color: '#fff', fontSize: 22, fontWeight: '700' },
  emblem: { position: 'absolute', top: 10, left: 10, width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(27,19,64,0.92)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  lock: { position: 'absolute', top: 10, right: 10, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(27,19,64,0.8)', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
