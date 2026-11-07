import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEngine } from '../audio';
import { GestureTracker, type GestureEvent, type World } from '../core/gestures';
import { computeLayout } from '../core/layout';
import { Session } from '../core/session';
import { popRate } from '../core/sfx';
import { audibleIds } from '../core/stageState';
import { autoName } from '../core/timeline';
import { TUNING } from '../core/tuning';
import type { Stage } from '../core/types';
import { t, type StringKey } from '../i18n';
import { useLang } from '../i18n/useLang';
import { useProgress } from '../app/progress';
import { ComboBook } from './ComboBook';
import { IconButton } from '../ui/IconButton';
import { WorldIcon } from '../ui/WorldIcon';
import { SceneCanvas, useSceneValues } from '../ui/SceneCanvas';
import { COLORS } from '../ui/theme';
import { hapticLight, hapticMedium, hapticSuccess, setHapticsEnabled } from '../ui/haptics';
import type { ReturningCreature } from '../ui/draw/scene';

interface Props {
  stage: Stage;
  onBack: () => void;
  onSongs: () => void;
  onHelp: () => void;
  onDebug?: (s: string) => void;
}

export function StageScreen({ stage, onBack, onSongs, onHelp, onDebug }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { rtl } = useLang();
  const { progress, discover, addSong, update } = useProgress();
  const [sysReduce, setSysReduce] = useState(false);
  const reduceMotion = progress.settings.reduceMotion || sysReduce;
  const padX = Math.max(insets.left, insets.right) + 8;
  const layout = useMemo(() => computeLayout(width, height, undefined, padX), [width, height, padX]);
  const sv = useSceneValues(stage, layout, reduceMotion);
  const engine = useMemo(() => getEngine(), []);
  const [session] = useState(() => new Session(stage, engine, {}, progress.discoveredCombos, progress.goals));
  const tracker = useRef(new GestureTracker()).current;
  const anim = useRef(new Map<string, { since: number; from: { x: number; y: number } }>()).current;
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recBars, setRecBars] = useState(0);
  const [book, setBook] = useState(false);
  const [limitMsg, setLimitMsg] = useState(false);
  const [, force] = useState(0);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => { setHapticsEnabled(progress.settings.haptics); engine.setVolume(progress.settings.musicVolume); }, [engine, progress.settings.haptics, progress.settings.musicVolume]);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSysReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSysReduce);
    return () => sub.remove();
  }, []);

  const now = () => sv.timeMs.value;
  const syncScene = useCallback(() => {
    const st = session.state;
    const l = layoutRef.current;
    sv.placed.value = st.spots.flatMap((id, spot) => {
      if (!id) return [];
      const a = anim.get(id);
      return [{ id, spot, since: a?.since ?? -1e6, from: a?.from ?? l.spots[spot]! }];
    });
    sv.muted.value = st.muted;
    sv.solo.value = st.solo;
    sv.volumes.value = st.volume;
    const pu = sv.popup.value;
    if (pu) sv.popup.value = st.spots[pu.spot] === pu.creatureId ? { ...pu, volume: st.volume[pu.creatureId] ?? 1, solo: st.solo === pu.creatureId } : null;
    onDebug?.(`${stage.id} on=${audibleIds(st).length}`);
    force((n) => n + 1);
  }, [session, sv, anim, onDebug, stage.id]);

  // Boot: audio engine, content, session
  useEffect(() => {
    let alive = true;
    session.countIn = !progressRef.current.firstDropDone;
    sv.hint.value = !progressRef.current.firstDropDone;
    session.setEvents({
      onState: () => syncScene(),
      onCelebration: (id, bar) => {
        const combo = stage.combos.find((c) => c.id === id)!;
        sv.celebration.value = { celebrationId: combo.celebrationId, creatureIds: combo.creatureIds as unknown as string[], startBeat: bar * TUNING.beatsPerBar };
        discover(id);
        hapticSuccess();
        engine.playSfx('combo');
      },
      onGoal: (key) => { engine.playSfx('goal'); update((p) => (p.goals.includes(key) ? p : { ...p, goals: [...p.goals, key] })); },
      onCelebrationEnd: () => { sv.celebration.value = null; },
      onRecordingLimit: () => stopRecording(),
      onBar: (bar) => { if (session.recorder) setRecBars(bar - session.recorder.startBar + 1); },
    });
    (async () => {
      await engine.init();
      await engine.loadStage(stage);
      if (!alive) return;
      session.start();
      setReady(true);
    })();
    const unsub = engine.onInterrupted(() => setPaused(true));
    const app = AppState.addEventListener('change', (s) => {
      if (s !== 'active') { engine.pause(); setPaused(true); if (session.recorder) stopRecording(); }
    });
    let raf = 0;
    const loop = () => {
      sv.beat.value = engine.state === 'running' ? engine.positionBeats() : sv.beat.value;
      if (sv.returning.value.length) {
        const t0 = now();
        const keep = sv.returning.value.filter((r) => t0 - r.since < TUNING.hopMs + 40);
        if (keep.length !== sv.returning.value.length) sv.returning.value = keep;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); unsub(); app.remove(); engine.stop(); };
  }, []);

  const stopRecording = useCallback(() => {
    if (!session.recorder) return;
    const names = progressRef.current.songs.map((s) => s.name);
    const song = session.stopRecording({ id: `song_${Date.now()}`, name: autoName(names), createdAt: Date.now() });
    setRecording(false);
    setRecBars(0);
    if (song) addSong(song);
  }, [session, addSong]);

  const onRecord = () => {
    if (recording) return stopRecording();
    if (progressRef.current.songs.length >= TUNING.maxSongs) return setLimitMsg(true);
    session.startRecording();
    setRecording(true);
  };

  const world = (): World => ({ layout: layoutRef.current, scrollX: sv.scrollX.value, trayIds: stage.creatures.map((c) => c.id), onStage: session.state.spots, popup: sv.popup.value ? { spot: sv.popup.value.spot, creatureId: sv.popup.value.creatureId } : null, volumeOf: (id) => session.state.volume[id] ?? 1 });

  const apply = (ev: GestureEvent) => {
    const l = layoutRef.current;
    const withoutDrag = (id: string) => sv.drags.value.filter((d) => d.id !== id);
    const goBack = (id: string, from: { x: number; y: number }) => {
      const r: ReturningCreature = { id, since: now(), from };
      sv.returning.value = [...sv.returning.value.filter((x) => x.id !== id), r];
    };
    switch (ev.type) {
      case 'pickup':
        hapticLight();
        engine.playSfx('pickup');
        sv.drags.value = [...withoutDrag(ev.creatureId), { id: ev.creatureId, x: ev.p.x, y: ev.p.y }];
        break;
      case 'drag':
        sv.drags.value = sv.drags.value.map((d) => (d.id === ev.creatureId ? { ...d, x: ev.p.x, y: ev.p.y } : d));
        break;
      case 'drop': {
        sv.drags.value = withoutDrag(ev.creatureId);
        const old = session.state.spots[ev.spot];
        if (old && old !== ev.creatureId) goBack(old, l.spots[ev.spot]!);
        anim.set(ev.creatureId, { since: now(), from: { x: ev.p.x, y: ev.p.y + l.size * 0.6 } });
        hapticMedium();
        engine.playSfx('pop', popRate(stage.key, ev.spot));
        session.dispatch({ kind: 'drop', creatureId: ev.creatureId, spot: ev.spot });
        if (!progressRef.current.firstDropDone) {
          session.countIn = false;
          sv.hint.value = false;
          update((p) => ({ ...p, firstDropDone: true }));
        }
        syncScene();
        break;
      }
      case 'returnToTray':
        sv.drags.value = withoutDrag(ev.creatureId);
        goBack(ev.creatureId, { x: ev.p.x, y: ev.p.y + l.size * 0.6 });
        break;
      case 'remove':
        sv.drags.value = withoutDrag(ev.creatureId);
        goBack(ev.creatureId, { x: ev.p.x, y: ev.p.y + l.size * 0.6 });
        session.dispatch({ kind: 'remove', creatureId: ev.creatureId });
        engine.playSfx('remove');
        hapticLight();
        syncScene();
        break;
      case 'tap':
        hapticLight();
        engine.playSfx(session.state.muted[ev.creatureId] ? 'unmute' : 'mute');
        session.dispatch({ kind: 'mute', creatureId: ev.creatureId });
        syncScene();
        break;
      case 'longPress': {
        hapticMedium();
        const spot = session.state.spots.indexOf(ev.creatureId);
        if (spot >= 0) sv.popup.value = { spot, creatureId: ev.creatureId, volume: session.state.volume[ev.creatureId] ?? 1, solo: session.state.solo === ev.creatureId };
        break;
      }
      case 'volumeSet':
        session.dispatch({ kind: 'volume', creatureId: ev.creatureId, value: ev.value });
        syncScene();
        break;
      case 'popupSolo':
        hapticMedium();
        session.dispatch({ kind: 'solo', creatureId: ev.creatureId });
        syncScene();
        break;
      case 'popupClose':
        sv.popup.value = null;
        break;
      case 'tapEmpty':
        session.dispatch({ kind: 'endSolo' });
        syncScene();
        break;
      case 'scroll':
        sv.scrollX.value = ev.scrollX;
        break;
    }
  };

  const touchFn = (kind: 'start' | 'move' | 'end' | 'cancel') => (e: GestureResponderEvent) => {
    if (!ready || paused) return;
    const ts = Date.now();
    for (const tc of e.nativeEvent.changedTouches) {
      const p = { x: tc.pageX, y: tc.pageY };
      const id = Number(tc.identifier);
      const evs =
        kind === 'start' ? tracker.start(id, p, ts, world()) :
        kind === 'move' ? tracker.move(id, p, ts, world()) :
        kind === 'end' ? tracker.end(id, p, ts, world()) : tracker.cancel(id, world());
      evs.forEach(apply);
      if (kind === 'start' && tracker.hasPendingLongPress) setTimeout(() => tracker.tick(Date.now(), world()).forEach(apply), TUNING.longPressMs + 10);
    }
  };

  const onStageCount = session.state.spots.filter(Boolean).length;
  const row = rtl ? 'row-reverse' : 'row';

  return (
    <View style={styles.root}>
      <SceneCanvas sv={sv} width={width} height={height} />
      <View style={StyleSheet.absoluteFill} onTouchStart={touchFn('start')} onTouchMove={touchFn('move')} onTouchEnd={touchFn('end')} onTouchCancel={touchFn('cancel')} />

      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 6, left: insets.left + 10, right: insets.right + 10, flexDirection: row }]}>
        <IconButton icon="back" label={t('a11y.back')} onPress={onBack} />
        <View style={styles.world} accessibilityLabel={t(stage.nameKey as StringKey)}><WorldIcon stageId={stage.id} size={34} /></View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: row, gap: 10, alignItems: 'center' }}>
          {recording && <Text style={styles.rec} accessibilityLabel={`${recBars}`}>{recBars}</Text>}
          <IconButton icon={recording ? 'stop' : 'record'} label={recording ? t('a11y.stopRecord') : t('a11y.record')} caption={recording ? t('ui.stop') : t('ui.record')} color={recording ? '#FFFFFF' : COLORS.rec} bg={recording ? COLORS.rec : undefined} onPress={onRecord} />
          <IconButton icon="book" label={t('a11y.comboBook')} caption={t('ui.combos')} onPress={() => setBook(true)} />
          <IconButton icon="note" label={t('a11y.songs')} caption={t('ui.songs')} onPress={onSongs} />
          <IconButton icon="help" label={t('a11y.help')} caption={t('ui.help')} onPress={onHelp} />
        </View>
      </View>
      <View pointerEvents="box-none" style={[styles.clear, { right: insets.right + 14, top: layout.stageH - 70 }]}>
        {onStageCount > 0 && <IconButton icon="sweep" label={t('a11y.clear')} caption={t('ui.clear')} onPress={() => {
          const l = layoutRef.current;
          for (const id of session.state.spots) if (id) { const s = session.state.spots.indexOf(id); goBackAll(id, l.spots[s]!); }
          session.dispatch({ kind: 'clear' });
          syncScene();
        }} />}
      </View>

      {book && <ComboBook stage={stage} session={session} discovered={progress.discoveredCombos} onClose={() => setBook(false)} onReplay={(id) => { setBook(false); session.replayCombo(id); }} />}
      {limitMsg && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <IconButton icon="full" label={t('songs.limit')} onPress={() => setLimitMsg(false)} haptics={false} />
            <Text style={styles.cardText}>{t('songs.limit')}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <IconButton icon="note" label={t('a11y.songs')} onPress={() => { setLimitMsg(false); onSongs(); }} />
              <IconButton icon="close" label={t('a11y.close')} onPress={() => setLimitMsg(false)} />
            </View>
          </View>
        </View>
      )}
      {paused && (
        <View style={styles.overlay}>
          <IconButton icon="play" label={t('a11y.play')} size={96} onPress={() => { engine.resume(); setPaused(false); }} />
        </View>
      )}
    </View>
  );

  function goBackAll(id: string, from: { x: number; y: number }) {
    sv.returning.value = [...sv.returning.value, { id, since: now(), from }];
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky },
  top: { position: 'absolute', alignItems: 'center' },
  world: { marginHorizontal: 10, width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(27,19,64,0.92)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  clear: { position: 'absolute' },
  rec: { color: '#fff', fontSize: 18, fontWeight: '700', backgroundColor: COLORS.rec, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,6,32,0.6)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: COLORS.panel, padding: 24, borderRadius: 24, alignItems: 'center', gap: 16, maxWidth: 420 },
  cardText: { color: COLORS.text, fontSize: 18, textAlign: 'center' },
});
