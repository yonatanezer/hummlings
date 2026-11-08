import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEngine } from '../audio';
import { getStage } from '../content';
import { exportSong, saveSongToDevice, type ExportResult } from '../app/exportSong';
import { useProgress } from '../app/progress';
import type { Song } from '../core/timeline';
import { clampName } from '../core/timeline';
import { barSec } from '../core/tuning';
import { t, type StringKey } from '../i18n';
import { useLang } from '../i18n/useLang';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { useParentalGate } from '../ui/ParentalGate';
import { COLORS } from '../ui/theme';

const fmtLen = (song: Song, bpm: number): string => {
  const s = Math.round(song.bars * barSec(bpm));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function SongsScreen({ onBack, onPlay }: { onBack: () => void; onPlay: (songId: string) => void }) {
  const insets = useSafeAreaInsets();
  const { rtl } = useLang();
  const { progress, update } = useProgress();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<ExportResult | null>(null);
  const { ask, gate } = useParentalGate();
  const row = rtl ? 'row-reverse' : 'row';

  const share = async (song: Song) => {
    setBusy(song.id);
    const engine = getEngine();
    await engine.init();
    const r = await exportSong(engine, getStage(song.stageId), song);
    setBusy(null);
    setMsg(r === 'shared' ? null : r);
  };
  const saveDev = async (song: Song) => {
    setBusy(song.id);
    const engine = getEngine();
    await engine.init();
    const r = await saveSongToDevice(engine, getStage(song.stageId), song);
    setBusy(null);
    setMsg(r === 'saved' ? 'saved' : r === 'cancelled' ? null : r);
  };
  const del = (song: Song) => Alert.alert(song.name, t('songs.deleteConfirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('songs.delete'), style: 'destructive', onPress: () => update((p) => ({ ...p, songs: p.songs.filter((s) => s.id !== song.id) })) },
  ]);
  const commit = (song: Song) => {
    const name = clampName(draft) || song.name;
    update((p) => ({ ...p, songs: p.songs.map((s) => (s.id === song.id ? { ...s, name } : s)) }));
    setRenaming(null);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6, paddingLeft: insets.left + 10, paddingRight: insets.right + 10, flexDirection: row }]}>
        <IconButton icon="back" label={t('a11y.back')} onPress={onBack} />
        <Text style={styles.title} accessibilityRole="header">{t('songs.title')}</Text>
      </View>
      {msg === 'saved' && <View style={[styles.banner, { flexDirection: row, backgroundColor: COLORS.ok }]}><Icon name="check" color="#10282A" size={28} /><Text style={[styles.bannerText, { color: '#10282A' }]}>{t('rec.savedDevice')}</Text></View>}
      {msg && msg !== 'shared' && msg !== 'saved' && (
        <View style={[styles.banner, { flexDirection: row }]}><Icon name="full" color="#fff" size={28} /><Text style={styles.bannerText}>{t('songs.storageFull')}</Text></View>
      )}
      {progress.songs.length >= 50 && <View style={[styles.banner, { flexDirection: row }]}><Icon name="full" color="#fff" size={28} /><Text style={styles.bannerText}>{t('songs.limit')}</Text></View>}
      {progress.songs.length === 0 ? (
        <View style={styles.empty}><Icon name="note" size={72} color={COLORS.textDim} /><Text style={styles.dim}>{t('songs.empty')}</Text></View>
      ) : (
        <FlatList
          data={[...progress.songs].reverse()}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 16, gap: 10, alignSelf: 'center', width: '100%', maxWidth: 760 }}
          renderItem={({ item }) => {
            const stage = getStage(item.stageId);
            return (
              <View style={[styles.item, { flexDirection: row }]}>
                <View style={{ flex: 1 }}>
                  {renaming === item.id ? (
                    <TextInput autoFocus value={draft} maxLength={24} onChangeText={setDraft} onSubmitEditing={() => commit(item)} onBlur={() => commit(item)} style={styles.input} accessibilityLabel={t('songs.rename')} />
                  ) : <Text style={styles.name}>{item.name}</Text>}
                  <Text style={styles.dim}>{t(stage.nameKey as StringKey)} · {fmtLen(item, stage.bpm)} · {t('songs.bars', { n: item.bars })} · {new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
                <IconButton icon="play" label={t('a11y.play')} onPress={() => onPlay(item.id)} />
                <IconButton icon="pencil" label={t('songs.rename')} onPress={() => { setRenaming(item.id); setDraft(item.name); }} />
                <IconButton icon="share" label={t('songs.share')} onPress={() => ask(() => void share(item))} bg={busy === item.id ? COLORS.accent : undefined} />
                <IconButton icon="download" label={t('rec.saveDevice')} onPress={() => ask(() => void saveDev(item))} bg={busy === item.id ? COLORS.accent : undefined} />
                <IconButton icon="trash" label={t('songs.delete')} color={COLORS.danger} onPress={() => del(item)} />
              </View>
            );
          }}
        />
      )}
      {gate}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky },
  header: { alignItems: 'center', gap: 16, paddingBottom: 8 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  item: { alignItems: 'center', gap: 10, backgroundColor: COLORS.panel, borderRadius: 18, padding: 10, minHeight: 72 },
  name: { color: '#fff', fontSize: 20, fontWeight: '700' },
  dim: { color: COLORS.textDim, fontSize: 14 },
  input: { color: '#fff', fontSize: 20, borderBottomWidth: 2, borderColor: COLORS.glow, padding: 4 },
  banner: { alignItems: 'center', gap: 10, marginHorizontal: 16, padding: 12, borderRadius: 14, backgroundColor: COLORS.danger },
  bannerText: { color: '#fff', fontSize: 16, flex: 1 },
});
