import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEngine } from '../audio';
import { GestureTracker, type GestureEvent, type World } from '../core/gestures';
import { computeLayout } from '../core/layout';
import { Session } from '../core/session';
import { popRate } from '../core/sfx';
import { randomBand } from '../core/surprise';
import { coachKind, pickSlot, pickSpot, pickTapSpot, type CoachCue } from '../core/coach';
import { audibleIds, nextFreeSpot, type StageState } from '../core/stageState';
import { autoName, warnBars, type Song } from '../core/timeline';
import { TUNING, barSec } from '../core/tuning';
import { exportSong, saveSongToDevice, type ExportResult } from '../app/exportSong';
import type { Stage } from '../core/types';
import { t, type StringKey } from '../i18n';
import { useLang } from '../i18n/useLang';
import { useProgress } from '../app/progress';
import { recallBand, rememberBand } from '../app/bandMemory';
import { ComboBook } from './ComboBook';
import { IconButton } from '../ui/IconButton';
import { WorldIcon } from '../ui/WorldIcon';
import { useParentalGate } from '../ui/ParentalGate';
import { SceneCanvas, useSceneValues } from '../ui/SceneCanvas';
import { COLORS } from '../ui/theme';
import { hapticLight, hapticMedium, hapticSuccess, setHapticsEnabled } from '../ui/haptics';
import type { ReturningCreature } from '../ui/draw/scene';

interface Props {
  stage: Stage;
  onBack: () => void;
  onSongs: () => void;
  onHelp: () => void;
  onPlay: (songId: string) => void;
  onDebug?: (s: string) => void;
}

/** The coach's last step: a ring that pulses around the record button (for someone who cannot read the label). */
function RecordPulse({ on }: { on: boolean }) {
  const k = useSharedValue(0);
  useEffect(() => {
    if (on) k.value = withRepeat(withSequence(withTiming(1, { duration: 650 }), withTiming(0, { duration: 650 })), -1);
    else { cancelAnimation(k); k.value = 0; }
  }, [on, k]);
  const st = useAnimatedStyle(() => ({ opacity: on ? 0.35 + k.value * 0.65 : 0, transform: [{ scale: 1 + k.value * 0.14 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -5, left: -5, width: 66, height: 66, borderRadius: 33, borderWidth: 4, borderColor: COLORS.rec }, st]} />;
}

export function StageScreen({ stage, onBack, onSongs, onHelp, onPlay, onDebug }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { rtl } = useLang();
  const { progress, discover, addSong, update } = useProgress();
  const [sysReduce, setSysReduce] = useState(false);
  const reduceMotion = progress.settings.reduceMotion || sysReduce;
  const padX = Math.max(insets.left, insets.right) + 8;
  const layout = useMemo(() => computeLayout(width, height, undefined, padX, insets.top + 66), [width, height, padX, insets.top]);
  const sv = useSceneValues(stage, layout, reduceMotion);
  const engine = useMemo(() => getEngine(), []);
  const [session] = useState(() => new Session(stage, engine, {}, progress.discoveredCombos, progress.goals));
  const tracker = useRef(new GestureTracker()).current;
  const anim = useRef(new Map<string, { since: number; from: { x: number; y: number } }>()).current;
  const [ready, setReady] = useState(false);
  const trayOpen = useRef(true);
  const { ask, gate } = useParentalGate();
  const [paused, setPaused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recBars, setRecBars] = useState(0);
  const [book, setBook] = useState(false);
  useEffect(() => { if (paused) setBook(false); }, [paused]); // the resume button must not sit on top of the combo book
  const [limitMsg, setLimitMsg] = useState(false);
  const [saved, setSaved] = useState<Song | null>(null);
  const [exportMsg, setExportMsg] = useState<ExportResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const [rewardDots, setRewardDots] = useState<{ done: number; total: number } | null>(null);
  const [undo, setUndo] = useState<StageState | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [screenReader, setScreenReader] = useState(false);
  const [, force] = useState(0);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [recordCue, setRecordCue] = useState(false); // the record button pulses (the coach's last step)
  const lastTouch = useRef(Date.now()); // the coach waits for a pause before it shows the next step

  useEffect(() => { setHapticsEnabled(progress.settings.haptics); engine.setVolume(progress.settings.musicVolume); }, [engine, progress.settings.haptics, progress.settings.musicVolume]);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSysReduce);
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    const srSub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSysReduce);
    return () => { sub.remove(); srSub.remove(); };
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
      await engine.loadStage(stage, { background: true });
      if (!alive) return;
      session.start();
      const before = recallBand(stage.id); // coming back from the guide, songs or settings: the band is still on stage
      if (before) {
        before.spots.forEach((id, spot) => { if (id) { session.dispatch({ kind: 'drop', creatureId: id, spot }); const v = before.volume[id]; if (v !== undefined) session.dispatch({ kind: 'volume', creatureId: id, value: v }); if (before.muted[id]) session.dispatch({ kind: 'mute', creatureId: id }); } });
        syncScene();
        if (before.spots.some(Boolean)) session.countIn = false;
      }
      setReady(true);
    })();
    const unsub = engine.onInterrupted(() => setPaused(true));
    const app = AppState.addEventListener('change', (s) => {
      if (s !== 'active') { engine.pause(); setPaused(true); if (session.recorder) stopRecording(); }
    });
    let raf = 0;
    let lastBeat = -1;
    const loop = () => {
      // Every write re-runs the scene on the UI thread, so only write when the beat moved enough to be seen (~16 ms of music).
      if (engine.state === 'running') { const b = engine.positionBeats(); if (Math.abs(b - lastBeat) >= 0.02) { lastBeat = b; sv.beat.value = b; } }
      const rw = session.reward;
      if (rw && !session.celebrating) {
        const total = Math.max(1, rw.startBeat - rw.fromBeat);
        const left = Math.max(0, rw.startBeat - sv.beat.value);
        sv.reward.value = { progress: Math.min(1, Math.max(0, 1 - left / total)) };
        const totalBars = Math.max(1, Math.round(total / TUNING.beatsPerBar));
        const done = Math.min(totalBars, Math.floor(totalBars - left / TUNING.beatsPerBar));
        setRewardDots((v) => (v && v.done === done && v.total === totalBars ? v : { done, total: totalBars }));
      } else if (sv.reward.value) { sv.reward.value = null; setRewardDots(null); }
      if (sv.returning.value.length) {
        const t0 = now();
        const keep = sv.returning.value.filter((r) => t0 - r.since < TUNING.hopMs + 40);
        if (keep.length !== sv.returning.value.length) sv.returning.value = keep;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; rememberBand(stage.id, session.state); cancelAnimationFrame(raf); unsub(); app.remove(); engine.stop(); };
  }, []);

  const stopRecording = useCallback(() => {
    if (!session.recorder) return;
    const names = progressRef.current.songs.map((s) => s.name);
    const song = session.stopRecording({ id: `song_${Date.now()}`, name: autoName(names, (n) => t('songs.defaultName', { n })), createdAt: Date.now() });
    setRecording(false);
    setRecBars(0);
    if (song) { addSong(song); setSaved(song); setExportMsg(null); }
  }, [session, addSong]);

  const onRecord = () => {
    if (recording) return stopRecording();
    if (progressRef.current.songs.length >= TUNING.maxSongs) return setLimitMsg(true);
    session.startRecording();
    setRecording(true);
    if (!progressRef.current.coachRecordDone) update((p) => ({ ...p, coachRecordDone: true }));
  };

  const world = (): World => ({ layout: layoutRef.current, scrollX: sv.scrollX.value, trayIds: stage.creatures.map((c) => c.id), onStage: session.state.spots, popup: sv.popup.value ? { spot: sv.popup.value.spot, creatureId: sv.popup.value.creatureId } : null, volumeOf: (id) => session.state.volume[id] ?? 1, trayHidden: !trayOpen.current });

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
        if (!progressRef.current.coachTapDone) update((p) => ({ ...p, coachTapDone: true }));
        engine.playSfx(session.state.muted[ev.creatureId] ? 'unmute' : 'mute');
        session.dispatch({ kind: 'mute', creatureId: ev.creatureId });
        syncScene();
        break;
      case 'longPress': {
        hapticMedium();
        if (!progressRef.current.coachHoldDone) update((p) => ({ ...p, coachHoldDone: true }));
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
      case 'trayTap': {
        const spot = nextFreeSpot(session.state);
        const i = stage.creatures.findIndex((c) => c.id === ev.creatureId);
        if (spot < 0 || i < 0) { engine.playSfx('mute'); break; } // stage is full
        apply({ type: 'drop', touch: -1, creatureId: ev.creatureId, spot, p: { x: l.slotPos[i]!.x - sv.scrollX.value, y: l.slotPos[i]!.y - l.size * 0.6 } });
        break;
      }
      case 'popupClose':
        sv.popup.value = null;
        break;
      case 'trayHide':
      case 'trayShow':
        trayOpen.current = ev.type === 'trayShow';
        sv.trayK.value = withTiming(trayOpen.current ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
        break;
      case 'tapEmpty': {
        session.dispatch({ kind: 'endSolo' });
        syncScene();
        if (ev.p.y < l.stageH) { // the world's toy: tapping the scenery plays a note of the scale, with an effect
          const deg = Math.max(0, Math.min(5, Math.floor((ev.p.x / l.W) * 6)));
          engine.playSfx('pop', popRate(stage.key, deg) * 2);
          const kind = stage.id === 'pond' || stage.id === 'neon' ? 'ripple' : stage.id === 'fair' ? 'spark' : 'star';
          const t0 = sv.timeMs.value;
          sv.taps.value = [...sv.taps.value.filter((e) => t0 - e.t0 < 1400), { x: ev.p.x, y: ev.p.y, t0, kind }];
        }
        break;
      }
      case 'scroll':
        sv.scrollX.value = ev.scrollX;
        break;
    }
  };

  const touchFn = (kind: 'start' | 'move' | 'end' | 'cancel') => (e: GestureResponderEvent) => {
    // Lift/cancel events must always be handled: dropping them while paused left a creature stuck in the "dragged" list, drawn big and forever.
    if ((!ready || paused) && kind !== 'end' && kind !== 'cancel') return;
    lastTouch.current = Date.now();
    if (kind === 'start' && tracker.activeCount === 0 && sv.drags.value.length) sv.drags.value = [];
    const ts = Date.now();
    for (const tc of e.nativeEvent.changedTouches) {
      const p = { x: tc.pageX, y: tc.pageY };
      const id = Number(tc.identifier);
      const evs =
        kind === 'start' ? tracker.start(id, p, ts, world()) :
        kind === 'move' ? tracker.move(id, p, ts, world()) :
        kind === 'end' ? tracker.end(id, p, ts, world()) : tracker.cancel(id, world());
      evs.forEach(apply);
      if ((kind === 'end' || kind === 'cancel') && tracker.activeCount === 0 && sv.drags.value.length) sv.drags.value = []; // no finger is down, so nothing can still be dragged
      if (kind === 'start' && tracker.hasPendingLongPress) setTimeout(() => tracker.tick(Date.now(), world()).forEach(apply), TUNING.longPressMs + 10);
    }
  };

  // The wordless coach (see core/coach.ts): every half second decide whether a hand should show the next step, and which one.
  useEffect(() => {
    const id = setInterval(() => {
      const pr = progressRef.current;
      const st = session.state;
      const onStage = st.spots.filter(Boolean).length;
      if (onStage >= 3 && !pr.coachMoreDone) update((p) => (p.coachMoreDone ? p : { ...p, coachMoreDone: true }));
      let cue: CoachCue | null = null;
      if (ready && !paused && !book && !recording && !gate && !sv.popup.value) {
        const kind = coachKind({ onStage, firstDropDone: pr.firstDropDone, moreDone: pr.coachMoreDone || onStage >= 3, tapDone: pr.coachTapDone, holdDone: pr.coachHoldDone, recordDone: pr.coachRecordDone || pr.songs.length > 0, idleMs: Date.now() - lastTouch.current });
        const l = layoutRef.current;
        if (kind === 'drag') cue = { kind, slot: pickSlot(stage.creatures.map((c) => c.id), new Set(st.spots.filter((x): x is string => !!x)), l.slotPos.map((p) => p.x - sv.scrollX.value), l.W), spot: pickSpot(st.spots) };
        else if (kind === 'tap' || kind === 'hold') cue = { kind, slot: -1, spot: pickTapSpot(st.spots, st.muted) };
        setRecordCue(kind === 'record');
      } else setRecordCue(false);
      const cur = sv.coach.value;
      if ((cue?.kind ?? null) !== (cur?.kind ?? null) || (cue?.spot ?? -1) !== (cur?.spot ?? -1) || (cue?.slot ?? -1) !== (cur?.slot ?? -1)) sv.coach.value = cue;
    }, 500);
    return () => clearInterval(id);
  }, [ready, paused, book, recording, gate, session, sv, stage, update]);

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
          {recording && (() => {
            const secs = Math.round(recBars * barSec(stage.bpm));
            const warn = recBars >= warnBars(stage.bpm);
            return <Text style={[styles.rec, warn && styles.recWarn]} accessibilityLabel={`${t('rec.recording')} ${secs}`}>{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</Text>;
          })()}
          <View><RecordPulse on={recordCue && !recording} /><IconButton icon={recording ? 'stop' : 'record'} label={recording ? t('a11y.stopRecord') : t('a11y.record')} caption={recording ? t('ui.stop') : t('ui.record')} color={recording ? '#FFFFFF' : COLORS.rec} bg={recording ? COLORS.rec : undefined} onPress={onRecord} /></View>
          <IconButton icon="combos" label={t('a11y.comboBook')} caption={t('ui.combos')} onPress={() => setBook(true)} />
          <IconButton icon="note" label={t('a11y.songs')} caption={t('ui.songs')} onPress={onSongs} />
          <IconButton icon="help" label={t('a11y.help')} caption={t('ui.help')} onPress={onHelp} />
        </View>
      </View>
      <View pointerEvents="box-none" style={[styles.clear, { left: insets.left + 14, top: layout.stageH - 84 }]}>
        <IconButton icon="dice" label={t('a11y.surprise')} caption={t('ui.surprise')} onPress={() => {
          const l = layoutRef.current;
          rememberForUndo();
          for (const id of session.state.spots) if (id) goBackAll(id, l.spots[session.state.spots.indexOf(id)]!);
          session.dispatch({ kind: 'clear' });
          randomBand(stage).forEach((id, spot) => {
            anim.set(id, { since: now() + spot * 90, from: l.slotPos[stage.creatures.findIndex((c) => c.id === id)]! });
            session.dispatch({ kind: 'drop', creatureId: id, spot });
          });
          engine.playSfx('goal');
          syncScene();
        }} />
      </View>
      <View pointerEvents="box-none" style={[styles.clear, { right: insets.right + 14, top: layout.stageH - 84 }]}>
        {onStageCount > 0 && <IconButton icon="sweep" label={t('a11y.clear')} caption={t('ui.clear')} onPress={() => {
          const l = layoutRef.current;
          rememberForUndo();
          for (const id of session.state.spots) if (id) { const s = session.state.spots.indexOf(id); goBackAll(id, l.spots[s]!); }
          session.dispatch({ kind: 'clear' });
          syncScene();
        }} />}
      </View>

      {book && <ComboBook stage={stage} session={session} discovered={progress.discoveredCombos} onClose={() => setBook(false)} onReplay={(id) => { setBook(false); session.replayCombo(id); }} />}
      {screenReader && ready && (
        <>
          <ScrollView horizontal style={[styles.srTray, { top: layout.tray.y, height: layout.tray.h }]} contentContainerStyle={{ alignItems: 'center' }}>
            {stage.creatures.map((c, i) => {
              const on = session.state.spots.includes(c.id);
              const label = `${t(`layer.${c.layer}` as StringKey)} ${(i % TUNING.perLayer) + 1}${on ? `, ${t('a11y.onStage')}` : ''}`;
              return <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={label} style={styles.srBtn}
                onPress={() => (on ? (session.dispatch({ kind: 'remove', creatureId: c.id }), syncScene()) : apply({ type: 'trayTap', creatureId: c.id }))} />;
            })}
          </ScrollView>
          {session.state.spots.map((id, spot) => {
            if (!id) return null;
            const c = stage.creatures.find((q) => q.id === id)!;
            const sp = layout.spots[spot]!;
            const label = `${t(`layer.${c.layer}` as StringKey)} ${(stage.creatures.indexOf(c) % TUNING.perLayer) + 1}, ${t('a11y.onStage')}`;
            const level = Math.round((session.state.volume[id] ?? 1) * 100);
            return (
              <Pressable key={id} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: `${level}%${session.state.muted[id] ? ', ' + t('a11y.mute') : ''}` }}
                accessibilityActions={[{ name: 'increment', label: t('a11y.louder') }, { name: 'decrement', label: t('a11y.quieter') }, { name: 'activate', label: t('a11y.mute') }, { name: 'longpress', label: t('a11y.solo') }, { name: 'magicTap', label: t('a11y.remove') }]}
                onAccessibilityAction={(e) => {
                  const n = e.nativeEvent.actionName;
                  const v = session.state.volume[id] ?? 1;
                  if (n === 'increment') apply({ type: 'volumeSet', creatureId: id, value: Math.min(1, v + 0.1) });
                  else if (n === 'decrement') apply({ type: 'volumeSet', creatureId: id, value: Math.max(0, v - 0.1) });
                  else if (n === 'longpress') apply({ type: 'popupSolo', creatureId: id });
                  else if (n === 'magicTap') apply({ type: 'remove', touch: -1, creatureId: id, p: sp });
                  else apply({ type: 'tap', creatureId: id });
                }}
                onPress={() => apply({ type: 'tap', creatureId: id })}
                style={{ position: 'absolute', left: sp.x - layout.size / 2, top: sp.y - layout.size * 1.1, width: layout.size, height: layout.size * 1.1 }} />
            );
          })}
        </>
      )}
      {undo && (
        <View pointerEvents="box-none" style={[styles.clear, { right: insets.right + 154, top: layout.stageH - 84 }]}>
          <IconButton icon="restore" label={t('a11y.undo')} caption={t('ui.undo')} bg={COLORS.accent} onPress={() => { restoreBand(undo); setUndo(null); }} />
        </View>
      )}
      {rewardDots !== null && !book && (
        <View pointerEvents="none" style={[styles.rewardSecs, { top: Math.max(layout.H * 0.2, 96) + Math.max(30, layout.size * 0.26) + 10 }]}>
          <View style={{ flexDirection: 'row', gap: 6 }}>{Array.from({ length: rewardDots.total }, (_, i) => <View key={i} style={[styles.rdot, i < rewardDots.done && styles.rdotOn]} />)}</View>
        </View>
      )}
      {saved && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('rec.saved')}</Text>
            <Text style={styles.cardText}>{saved.name}</Text>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <IconButton icon="play" label={t('a11y.play')} caption={t('a11y.play')} onPress={() => { const id = saved.id; setSaved(null); onPlay(id); }} />
              <IconButton icon="share" label={t('songs.share')} caption={t('songs.share')} bg={exporting ? COLORS.accent : undefined} onPress={() => ask(() => { setExporting(true); void exportSong(engine, stage, saved).then((r) => { setExporting(false); setExportMsg(r); }); })} />
              <IconButton icon="download" label={t('rec.saveDevice')} caption={t('rec.saveDevice')} bg={exporting ? COLORS.accent : undefined} onPress={() => ask(() => { setExporting(true); void saveSongToDevice(engine, stage, saved).then((r) => { setExporting(false); setExportMsg(r); }); })} />
              <IconButton icon="close" label={t('a11y.close')} caption={t('a11y.close')} onPress={() => setSaved(null)} />
            </View>
            {exportMsg === 'saved' && <Text style={styles.ok}>{t('rec.savedDevice')}</Text>}
            {(exportMsg === 'storage' || exportMsg === 'error') && <Text style={styles.fail}>{t('songs.storageFull')}</Text>}
          </View>
        </View>
      )}
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
      {gate}
      {paused && (
        <View style={styles.overlay}>
          <IconButton icon="play" label={t('a11y.play')} size={96} onPress={() => { engine.resume(); setPaused(false); }} />
        </View>
      )}
    </View>
  );

  function rememberForUndo() {
    if (!session.state.spots.some(Boolean)) return;
    setUndo(session.state);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 7000);
  }
  function restoreBand(before: StageState) {
    for (const id of session.state.spots) if (id) session.dispatch({ kind: 'remove', creatureId: id });
    before.spots.forEach((id, spot) => {
      if (!id) return;
      session.dispatch({ kind: 'drop', creatureId: id, spot });
      const v = before.volume[id];
      if (v !== undefined) session.dispatch({ kind: 'volume', creatureId: id, value: v });
      if (before.muted[id]) session.dispatch({ kind: 'mute', creatureId: id });
    });
    syncScene();
  }
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
  rewardSecs: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(27,19,64,0.92)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 2, borderWidth: 2, borderColor: '#FFC857' },
  rdot: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.25)' },
  rdotOn: { backgroundColor: '#FFC857' },
  srTray: { position: 'absolute', left: 0, right: 0 },
  srBtn: { width: 72, height: 72, margin: 4 },
  cardTitle: { color: COLORS.glow, fontSize: 24, fontWeight: '800' },
  ok: { color: COLORS.ok, fontSize: 16, fontWeight: '700' },
  fail: { color: COLORS.danger, fontSize: 16, textAlign: 'center' },
  recWarn: { backgroundColor: '#FF1744', borderWidth: 2, borderColor: '#fff' },
  cardText: { color: COLORS.text, fontSize: 18, textAlign: 'center' },
});
