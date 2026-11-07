import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STAGES } from '../content';
import { getPurchases } from '../app/purchases';
import { useProgress } from '../app/progress';
import { t } from '../i18n';
import { IconButton } from '../ui/IconButton';
import { StageCardArt } from '../ui/StageCardArt';
import { WorldIcon } from '../ui/WorldIcon';
import { COLORS } from '../ui/theme';

/** Unlock screen (shown behind the parental gate). */
export function UnlockScreen({ onBack }: { onBack: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { update } = useProgress();
  const [price, setPrice] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'failed' | 'done'>('idle');
  useEffect(() => { void getPurchases().getPrice().then(setPrice); }, []);
  const cw = Math.min(width * 0.13, 150), ch = Math.min(height * 0.42, cw * 1.1);
  const buy = async () => {
    setStatus('pending');
    const r = await getPurchases().buy();
    if (r === 'purchased') { update((p) => ({ ...p, unlocked: true })); setStatus('done'); }
    else setStatus(r === 'pending' ? 'pending' : r === 'cancelled' ? 'idle' : 'failed');
  };
  const restore = async () => {
    const ok = await getPurchases().restore();
    if (ok) { update((p) => ({ ...p, unlocked: true })); setStatus('done'); } else setStatus('failed');
  };
  return (
    <View style={styles.root}>
      <View style={[styles.close, { top: insets.top + 6, right: insets.right + 10 }]}><IconButton icon="close" label={t('a11y.close')} onPress={onBack} /></View>
      <View style={styles.main}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {STAGES.slice(1).map((st) => <View key={st.id}><StageCardArt stage={st} locked={false} width={cw} height={ch} /><View style={{ position: 'absolute', top: 8, left: 8, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(27,19,64,0.92)', alignItems: 'center', justifyContent: 'center' }}><WorldIcon stageId={st.id} size={34} /></View></View>)}
        </View>
        <View style={{ maxWidth: 360, gap: 14 }}>
          <Text style={styles.title} accessibilityRole="header">{t('unlock.title')}</Text>
          <Text style={styles.body}>{t('unlock.body')}</Text>
          {status === 'done' ? <Text style={styles.ok}>{t('unlock.done')}</Text> : (
            <Pressable accessibilityRole="button" accessibilityLabel={t('unlock.buy', { price: price ?? '' })} disabled={status === 'pending'} onPress={() => void buy()} style={[styles.buy, status === 'pending' && { opacity: 0.6 }]}>
              <Text style={styles.buyText}>{status === 'pending' ? t('unlock.pending') : t('unlock.buy', { price: price ?? '' })}</Text>
            </Pressable>
          )}
          {status === 'failed' && <Text style={styles.fail}>{t('unlock.failed')}</Text>}
          <Pressable accessibilityRole="button" onPress={() => void restore()} style={{ minHeight: 56, justifyContent: 'center' }}>
            <Text style={styles.link}>{t('unlock.restore')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky, justifyContent: 'center' },
  close: { position: 'absolute', zIndex: 2 },
  main: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800' },
  body: { color: COLORS.textDim, fontSize: 18, lineHeight: 26 },
  buy: { minHeight: 64, borderRadius: 32, backgroundColor: COLORS.ok, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  buyText: { color: '#10282A', fontSize: 22, fontWeight: '800' },
  ok: { color: COLORS.ok, fontSize: 22, fontWeight: '700' },
  fail: { color: COLORS.danger, fontSize: 16 },
  link: { color: COLORS.accent, fontSize: 18, fontWeight: '600' },
});
