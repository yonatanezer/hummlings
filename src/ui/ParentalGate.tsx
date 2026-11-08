import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, cancelAnimation, runOnJS } from 'react-native-reanimated';
import { makeGate } from '../core/gate';
import { TUNING } from '../core/tuning';
import { t } from '../i18n';
import { IconButton } from './IconButton';
import { COLORS } from './theme';

/** Parental gate: solve a one-digit addition (digits only), then hold the ring for 2 seconds. */
export function ParentalGate({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) {
  const gate = useMemo(() => makeGate(), []);
  const [answer, setAnswer] = useState<number | null>(null);
  const [wrong, setWrong] = useState(false);
  const progress = useSharedValue(0);
  const holding = useRef(false);
  const ringStyle = useAnimatedStyle(() => ({ width: 24 + progress.value * 64, height: 24 + progress.value * 64, borderRadius: 44 }));

  const done = () => { if (holding.current) onPass(); };
  const press = () => {
    if (answer !== gate.correct) { setWrong(true); return; }
    holding.current = true;
    progress.value = withTiming(1, { duration: TUNING.gateHoldMs }, (fin) => { if (fin) runOnJS(done)(); });
  };
  const release = () => { holding.current = false; cancelAnimation(progress); progress.value = withTiming(0, { duration: 200 }); };

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">{t('gate.title')}</Text>
        <Text style={styles.sum}>{gate.a} + {gate.b}</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {gate.options.map((o) => (
            <Pressable key={o} accessibilityRole="button" accessibilityLabel={`${o}`} onPress={() => { setAnswer(o); setWrong(o !== gate.correct); }}
              style={[styles.opt, answer === o && { borderColor: COLORS.glow, backgroundColor: COLORS.panelLight }]}>
              <Text style={styles.optText}>{o}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.hint, wrong && { color: COLORS.danger }]}>{wrong ? t('gate.wrong') : t('gate.hold')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('gate.hold')} onPressIn={press} onPressOut={release} style={styles.holdWrap}>
          <Animated.View style={[styles.ring, ringStyle]} />
        </Pressable>
        <View style={styles.cancel}><IconButton icon="close" label={t('common.cancel')} onPress={onCancel} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,6,32,0.85)', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  card: { backgroundColor: COLORS.panel, borderRadius: 28, padding: 24, alignItems: 'center', gap: 14, width: 440 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  sum: { color: COLORS.glow, fontSize: 44, fontWeight: '800' },
  opt: { width: 80, height: 72, borderRadius: 20, backgroundColor: COLORS.floor, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  optText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  hint: { color: COLORS.textDim, fontSize: 16 },
  holdWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', borderRadius: 50, backgroundColor: COLORS.floor },
  ring: { backgroundColor: COLORS.ok },
  cancel: { position: 'absolute', top: 8, right: 8 },
});

/** Asks a grown-up first (sum + 2-second hold), then runs the action. Used before sharing or saving a song outside the app. */
export function useParentalGate(): { ask: (action: () => void) => void; gate: ReactElement | null } {
  const [pending, setPending] = useState<null | (() => void)>(null);
  const ask = useCallback((action: () => void) => setPending(() => action), []);
  const gate = pending ? <ParentalGate onPass={() => { const a = pending; setPending(null); a(); }} onCancel={() => setPending(null)} /> : null;
  return { ask, gate };
}
