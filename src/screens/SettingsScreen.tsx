import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_VERSION, PRIVACY_URL } from '../app/config';
import { getPurchases } from '../app/purchases';
import { useProgress } from '../app/progress';
import { t } from '../i18n';
import { useLang } from '../i18n/useLang';
import { Icon, type IconName } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { ParentalGate } from '../ui/ParentalGate';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import { COLORS } from '../ui/theme';
import type { Settings } from '../core/progress';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { rtl } = useLang();
  const { progress, setSetting, reset, update } = useProgress();
  const s = progress.settings;
  const [gate, setGate] = useState<null | 'restore' | 'privacy'>(null);
  const [note, setNote] = useState('');
  const align = rtl ? 'row-reverse' : 'row';

  const Row = ({ label, icon, children }: { label: string; icon: IconName; children: React.ReactNode }) => (
    <View style={[styles.row, { flexDirection: align }]}><View style={{ flexDirection: align, alignItems: 'center', gap: 12 }}><Icon name={icon} size={30} color="#FFE8A3" /><Text style={styles.label}>{label}</Text></View>{children}</View>
  );
  const langs: Settings['language'][] = ['system', 'en', 'he'];

  const afterGate = async () => {
    const g = gate;
    setGate(null);
    if (g === 'privacy') void Linking.openURL(PRIVACY_URL);
    if (g === 'restore') {
      const ok = await getPurchases().restore();
      if (ok) update((p) => ({ ...p, unlocked: true }));
      setNote(ok ? t('unlock.done') : t('unlock.failed'));
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6, paddingLeft: insets.left + 10, paddingRight: insets.right + 10, flexDirection: align }]}>
        <IconButton icon="back" label={t('a11y.back')} onPress={onBack} />
        <Text style={styles.title} accessibilityRole="header">{t('settings.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Row label={t('settings.volume')} icon="volume"><View style={{ flex: 1, maxWidth: 320 }}><Slider label={t('settings.volume')} value={s.musicVolume} onChange={(v) => setSetting('musicVolume', v)} /></View></Row>
        <Row label={t('settings.introSound')} icon="note"><Toggle label={t('settings.introSound')} value={s.introSound} onChange={(v) => setSetting('introSound', v)} /></Row>
        <Row label={t('settings.haptics')} icon="vibrate"><Toggle label={t('settings.haptics')} value={s.haptics} onChange={(v) => setSetting('haptics', v)} /></Row>
        <Row label={t('settings.reduceMotion')} icon="motion"><Toggle label={t('settings.reduceMotion')} value={s.reduceMotion} onChange={(v) => setSetting('reduceMotion', v)} /></Row>
        <Row label={t('settings.language')} icon="globe">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {langs.map((l) => (
              <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: s.language === l }} onPress={() => setSetting('language', l)} style={[styles.seg, s.language === l && styles.segOn]}>
                <Text style={[styles.segText, s.language === l && styles.segTextOn]}>{t(`settings.language.${l}` as 'settings.language.en')}</Text>
              </Pressable>
            ))}
          </View>
        </Row>
        <Row label={t('settings.restore')} icon="restore"><IconButton icon="restore" label={t('settings.restore')} onPress={() => setGate('restore')} /></Row>
        <Row label={t('settings.privacy')} icon="info"><IconButton icon="info" label={t('settings.privacy')} onPress={() => setGate('privacy')} /></Row>
        <Row label={t('settings.reset')} icon="trash"><IconButton icon="trash" label={t('settings.reset')} color={COLORS.danger} onPress={() => Alert.alert(t('settings.reset'), t('settings.resetConfirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.confirm'), style: 'destructive', onPress: reset }])} /></Row>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <View style={styles.about}>
          <Text style={styles.label}>{t('settings.about')}</Text>
          <Text style={styles.dim}>{t('settings.version', { v: APP_VERSION })}</Text>
          <Text style={styles.dim}>{t('settings.credits')}</Text>
        </View>
      </ScrollView>
      {gate && <ParentalGate onPass={() => void afterGate()} onCancel={() => setGate(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky },
  header: { alignItems: 'center', gap: 16, paddingBottom: 8 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  body: { alignSelf: 'center', width: '100%', maxWidth: 620, padding: 16, gap: 10 },
  row: { minHeight: 64, alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: COLORS.panel, borderRadius: 18, paddingHorizontal: 18 },
  label: { color: '#fff', fontSize: 18, fontWeight: '600' },
  seg: { paddingHorizontal: 14, minHeight: 48, borderRadius: 14, backgroundColor: COLORS.floor, justifyContent: 'center' },
  segOn: { backgroundColor: COLORS.accent },
  segText: { color: '#fff', fontSize: 16 },
  segTextOn: { color: COLORS.sky, fontWeight: '700' }, // white on the blue chip was 2.99:1
  note: { color: COLORS.ok, fontSize: 16, textAlign: 'center' },
  about: { padding: 12, gap: 4 },
  dim: { color: COLORS.textDim, fontSize: 16 },
});
