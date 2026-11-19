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
import { AccentContext } from '../ui/IconButton';
import { coachKind, pickSlot, pickSpot, pickTapSpot, type CoachCue } from '../core/coach';
import { audibleIds, emptyStage, nextFreeSpot, swapSpot } from '../core/stageState';
import { hasLesson, LESSON_FINISH_MS, LESSON_LAYERS, LESSON_SCROLL_WAIT_MS, LESSON_STEPS, lessonCanPick, lessonCue, lessonLit, lessonScrollTarget, lessonStep, lessonTotalCoins, type LessonFx } from '../core/lesson';
import { autoName, defaultNameNumber, warnBars, type Song } from '../core/timeline';
import { TUNING, barSec } from '../core/tuning';
import { exportSong, saveSongToDevice, type ExportResult } from '../app/exportSong';
import { LAYER_COLORS, type Layer, type Stage } from '../core/types';
import { t, type StringKey } from '../i18n';
import { useLang } from '../i18n/useLang';
import { useProgress } from '../app/progress';
import { StageHud } from '../ui/StageHud';
import { recallBand, rememberBand } from '../app/bandMemory';
import { ComboBook, GOAL_ICON } from './ComboBook';
import { LessonDone } from '../ui/LessonDone';
import { STAGES, FREE_STAGE_IDS } from '../content';
import type { GoalId } from '../core/goals';
import { Icon, type IconName } from '../ui/Icon';
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
  onSwitch: (stageId: string) => void; // jump straight to another unlocked world
  onLocked: (stageId: string) => void; // a locked world: show its preview
  onSongs: () => void;
  onHelp: () => void;
  onPlay: (songId: string) => void;
  onDebug?: (s: string) => void;
}

/** A round arrow at the edge of the singer menu where more singers are hidden: it pulses, and a tap slides the menu. */
function TrayArrow({ side, y, offset, label, onPress }: { side: 'left' | 'right'; y: number; offset: number; label: string; onPress: () => void }) {
  const k = useSharedValue(0);
  useEffect(() => {
    k.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1);
    return () => cancelAnimation(k);
  }, [k]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: (side === 'right' ? 1 : -1) * k.value * 6 }], opacity: 0.8 + k.value * 0.2 }));
  return (
    <Animated.View style={[{ position: 'absolute', top: y - 26, [side]: offset }, st]}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress}
        style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(27,19,64,0.92)', borderWidth: 3, borderColor: '#FFE066', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={side === 'right' ? 'next' : 'back'} size={30} color="#FFE066" />
      </Pressable>
    </Animated.View>
  );
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

export function StageScreen({ stage, onBack, onSwitch, onLocked, onSongs, onHelp, onPlay, onDebug }: Props) {
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
  const [screenReader, setScreenReader] = useState(false);
  const [, force] = useState(0);
  const [toast, setToast] = useState<{ icons: IconName[]; text?: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [worlds, setWorlds] = useState(false);
  const [edges, setEdges] = useState({ left: false, right: false }); // the singer menu has more singers hidden on this side
  const scrollAnim = useRef(0);
  const peeked = useRef(false);
  const autoDemo = useRef(false);
  const showToast = (v: { icons: IconName[]; text?: string }) => { setToast(v); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2600); };
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [recordCue, setRecordCue] = useState(false); // the record button pulses (the coach's last step)
  const lastTouch = useRef(Date.now()); // the coach waits for a pause before it shows the next step
  // Level 1 of the world: the guided first lesson (core/lesson.ts). 'play' = running, 'done' = the success card is up, null = free play.
  const [lesson, setLesson] = useState<'play' | 'done' | null>(() => (!hasLesson(stage.id) || progress.lessonsDone.includes(stage.id) ? null : 'play'));
  const lessonRef = useRef(lesson);
  lessonRef.current = lesson;
  const lessonMeta = useRef({ step: -1, prev: null as Layer | null, since: 0, sinceMs: Date.now(), fx: [] as LessonFx[] }).current;
  const [lessonDir, setLessonDir] = useState<-1 | 0 | 1>(0); // the lit group is out of sight on this side (an arrow points there)
  const finishTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoScrollAt = useRef(0);

  useEffect(() => { setHapticsEnabled(progress.settings.haptics); engine.setVolume(progress.settings.musicVolume); }, [engine, progress.settings.haptics, progress.settings.musicVolume]);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSysReduce);
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    const srSub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSysReduce);
    return () => { sub.remove(); srSub.remove(); };
  }, []);

  const now = () => sv.timeMs.value;
  /** Hands the lesson's state (lit group, coins, flying coins) to the scene. */
  const publishLesson = useCallback(() => {
    if (lessonRef.current !== 'play') { if (sv.lesson.value) sv.lesson.value = null; return; }
    const m = lessonMeta, t0 = sv.timeMs.value;
    const step = lessonStep(stage, session.state.spots);
    if (step !== m.step) { m.prev = m.step >= 0 ? lessonLit(m.step) : null; m.step = step; m.since = t0; m.sinceMs = Date.now(); }
    m.fx = m.fx.filter((f) => t0 - f.t0 < 1300);
    sv.lesson.value = { lit: lessonLit(step), prev: m.prev, since: m.since, done: step, topY: insets.top + 38, fx: m.fx };
  }, [sv, stage, session, lessonMeta, insets.top]);
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
    publishLesson();
    force((n) => n + 1);
  }, [session, sv, anim, onDebug, stage.id, publishLesson]);
  useEffect(() => { publishLesson(); }, [publishLesson, lesson, ready]);

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
        showToast({ icons: ['combos'], text: t('combo.found') });
        hapticSuccess();
        engine.playSfx('combo');
      },
      onGoal: (key) => { engine.playSfx('goal'); const gid = key.split(':')[1] as GoalId; showToast({ icons: ['star', GOAL_ICON[gid] ?? 'star'], text: t(`goal.${gid}` as StringKey) }); sv.taps.value = [...sv.taps.value.filter((e) => sv.timeMs.value - e.t0 < 1400), ...[0.25, 0.5, 0.75].map((f) => ({ x: layoutRef.current.W * f, y: layoutRef.current.stageH * 0.3, t0: sv.timeMs.value, kind: 'drop' as const, color: '#FFE066' }))]; update((p) => (p.goals.includes(key) ? p : { ...p, goals: [...p.goals, key] })); },
      onCelebrationEnd: () => { sv.celebration.value = null; },
      onRecordingLimit: () => stopRecording(),
      onBar: (bar) => { if (session.recorder) setRecBars(bar - session.recorder.startBar + 1); },
    });
    (async () => {
      await engine.init();
      await engine.loadStage(stage, { background: true });
      if (!alive) return;
      session.start();
      const before = lessonRef.current === 'play' ? undefined : recallBand(stage.id); // coming back from the guide, songs or settings: the band is still on stage (the first lesson always starts from an empty stage)
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
      // Every beat write re-runs the whole scene on the UI thread: throttled by time (not by beats, so slow songs stay smooth): ~33 ms resting, ~12 ms while anything moves.
      const moving = sv.drags.value.length > 0 || sv.celebration.value !== null || sv.popup.value !== null || sv.coach.value !== null || sv.taps.value.length > 0 || sv.returning.value.length > 0 || sv.reward.value !== null;
      if (engine.state === 'running') { const b = engine.positionBeats(); if (Math.abs(b - lastBeat) >= (stage.bpm / 60) * (moving ? 0.012 : 0.033)) { lastBeat = b; sv.beat.value = b; } }
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
    return () => { alive = false; clearTimeout(finishTimer.current); rememberBand(stage.id, lessonRef.current === 'play' ? emptyStage() : session.state); cancelAnimationFrame(raf); unsub(); app.remove(); engine.stop(); };
  }, []);

  const stopRecording = useCallback(() => {
    if (!session.recorder) return;
    const names = progressRef.current.songs.map((s) => { const k = defaultNameNumber(s.name); return k === null ? s.name : t('songs.defaultName', { n: k }); }); // "Song 2" and "שיר 2" are the same name
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

  const world = (): World => {
    const on = lessonRef.current === 'play', step = on ? lessonStep(stage, session.state.spots) : LESSON_STEPS;
    return { layout: layoutRef.current, scrollX: sv.scrollX.value, trayIds: stage.creatures.map((c) => c.id), onStage: session.state.spots, popup: sv.popup.value ? { spot: sv.popup.value.spot, creatureId: sv.popup.value.creatureId } : null, volumeOf: (id) => session.state.volume[id] ?? 1, trayHidden: !trayOpen.current, canPick: on ? (id) => lessonCanPick(stage, step, id) : undefined, locked: on };
  };

  /** A singer of the lit group landed: a coin flies to the counter, stars burst, and when the fourth is in the whole song plays and the success card follows. */
  const lessonLanded = (stepBefore: number, spot: number) => {
    const l = layoutRef.current, sp = l.spots[spot]!;
    const step = lessonStep(stage, session.state.spots);
    if (step <= stepBefore) return;
    const t0 = sv.timeMs.value;
    lessonMeta.fx = [...lessonMeta.fx, { x: sp.x, y: sp.y - l.size * 0.6, t0, slot: stepBefore }];
    if (!reduceMotion) sv.taps.value = [...sv.taps.value.filter((e) => t0 - e.t0 < 1400), { x: sp.x, y: sp.y - l.size * 0.5, t0, kind: 'star' }];
    if (step >= LESSON_STEPS) {
      hapticSuccess();
      engine.playSfx('combo');
      sv.taps.value = [...sv.taps.value.filter((e) => t0 - e.t0 < 1400), ...[0.18, 0.38, 0.62, 0.82].map((f, i) => ({ x: l.W * f, y: l.stageH * (0.28 + 0.1 * (i % 2)), t0, kind: 'spark' as const }))];
      const coins = lessonTotalCoins();
      update((p) => (p.lessonsDone.includes(stage.id) ? p : { ...p, lessonsDone: [...p.lessonsDone, stage.id], coins: p.coins + coins, firstDropDone: true }));
      finishTimer.current = setTimeout(() => { engine.playSfx('goal'); setLesson('done'); }, LESSON_FINISH_MS);
    }
    publishLesson();
  };
  const skipLesson = () => {
    clearTimeout(finishTimer.current);
    update((p) => (p.lessonsDone.includes(stage.id) ? p : { ...p, lessonsDone: [...p.lessonsDone, stage.id] }));
    setLesson(null);
  };
  const scrollToLit = () => {
    const lit = lessonLit(lessonStep(stage, session.state.spots));
    const target = lit ? lessonScrollTarget(stage, layoutRef.current, sv.scrollX.value, lit) : null;
    if (target !== null) scrollTrayTo(target, 700);
  };

  const apply = (ev: GestureEvent) => {
    const l = layoutRef.current;
    const lessonOn = lessonRef.current === 'play';
    if (lessonOn && ev.type === 'trayTap' && !lessonCanPick(stage, lessonStep(stage, session.state.spots), ev.creatureId)) return; // a dark group (a screen reader can reach it)
    if (lessonOn && ev.type === 'drop' && session.state.spots[ev.spot]) { apply({ type: 'returnToTray', touch: ev.touch, creatureId: ev.creatureId, p: ev.p }); return; } // never take another singer's place
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
        const stepBefore = lessonOn ? lessonStep(stage, session.state.spots) : 0;
        { const t0 = sv.timeMs.value, sp = l.spots[ev.spot]!; sv.taps.value = [...sv.taps.value.filter((e) => t0 - e.t0 < 1400), { x: sp.x, y: sp.y - l.size * 0.3, t0, kind: 'drop', color: lessonOn ? LAYER_COLORS[LESSON_LAYERS[stepBefore] ?? 'voice'] : stage.palette.glow }]; }
        engine.playSfx('pop', lessonOn ? popRate(stage.key, Math.min(5, stepBefore + 1)) : popRate(stage.key, ev.spot)); // in the lesson every singer sings a higher note than the last
        session.dispatch({ kind: 'drop', creatureId: ev.creatureId, spot: ev.spot });
        if (!progressRef.current.firstDropDone) {
          session.countIn = false;
          update((p) => ({ ...p, firstDropDone: true }));
        }
        syncScene();
        if (lessonOn) lessonLanded(stepBefore, ev.spot);
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
        const i = stage.creatures.findIndex((c) => c.id === ev.creatureId);
        // a full stage: the new singer takes the place of one of the same kind (else a muted one, else the first), which hops back to the menu
        const spot = nextFreeSpot(session.state) >= 0 ? nextFreeSpot(session.state) : swapSpot(session.state, (id) => stage.creatures.find((c) => c.id === id)?.layer, ev.creatureId);
        if (i < 0) break;
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
        syncEdges();
        break;
    }
  };

  const applyRef = useRef(apply);
  applyRef.current = apply;
  const syncEdges = () => {
    const l = layoutRef.current, x = sv.scrollX.value;
    const left = x > 8, right = x < l.scrollMax - 8;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  const scrollTrayTo = (target: number, ms = 380) => {
    cancelAnimationFrame(scrollAnim.current);
    const from = sv.scrollX.value, t0 = Date.now();
    const to = Math.max(0, Math.min(layoutRef.current.scrollMax, target));
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      sv.scrollX.value = from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
      syncEdges();
      if (k < 1) scrollAnim.current = requestAnimationFrame(step);
    };
    step();
  };
  const touchFn = (kind: 'start' | 'move' | 'end' | 'cancel') => (e: GestureResponderEvent) => {
    // Lift/cancel events must always be handled: dropping them while paused left a creature stuck in the "dragged" list, drawn big and forever.
    if ((!ready || paused || lessonRef.current === 'done') && kind !== 'end' && kind !== 'cancel') return;
    lastTouch.current = Date.now();
    if (kind === 'start' && tracker.activeCount === 0 && sv.drags.value.length) sv.drags.value = [];
    if (kind === 'start' && !reduceMotion) { const t0 = sv.timeMs.value, q = e.nativeEvent.changedTouches[0]; if (q) sv.taps.value = [...sv.taps.value.filter((x) => t0 - x.t0 < 1400), { x: q.pageX, y: q.pageY, t0, kind: 'press' }]; }
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
      if (lessonRef.current === 'play') {
        // The first lesson takes over the coach: a hand shows the lit group's drag (or slides the menu towards it), and the menu slides by itself when nobody does.
        setRecordCue(false);
        if (!ready || paused) return;
        const l = layoutRef.current, step = lessonStep(stage, st.spots);
        const cue = lessonCue(stage, l, sv.scrollX.value, st.spots, step);
        const cur = sv.coach.value;
        if ((cue?.kind ?? null) !== (cur?.kind ?? null) || (cue?.spot ?? -1) !== (cur?.spot ?? -1) || (cue?.slot ?? -1) !== (cur?.slot ?? -1) || (cue?.dir ?? 0) !== (cur?.dir ?? 0)) sv.coach.value = cue;
        const dir = cue?.kind === 'swipe' ? (cue.dir ?? 1) : 0;
        setLessonDir((d) => (d === dir ? d : dir));
        const lit = lessonLit(step), idle = Date.now() - lastTouch.current;
        if (lit && dir !== 0 && tracker.activeCount === 0 && idle > LESSON_SCROLL_WAIT_MS && Date.now() - lessonMeta.sinceMs > LESSON_SCROLL_WAIT_MS && Date.now() - autoScrollAt.current > 2000) {
          const target = lessonScrollTarget(stage, l, sv.scrollX.value, lit);
          if (target !== null) { autoScrollAt.current = Date.now(); scrollTrayTo(target, 900); }
        }
        return;
      }
      // A new player who has not touched anything for a while: one singer hops onto the stage by itself, so the music starts and the idea is clear without words.
      if (ready && !paused && !book && !recording && !gate && !autoDemo.current && !pr.firstDropDone && onStage === 0 && Date.now() - lastTouch.current > 9000) {
        autoDemo.current = true;
        const first = stage.creatures[0];
        if (first) applyRef.current({ type: 'trayTap', creatureId: first.id });
      }
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

  // The menu holds more singers than fit: show it once by itself (a small slide and back), and keep arrows at the edges where more singers are hidden.
  useEffect(() => {
    syncEdges();
    if (!ready || peeked.current || layout.scrollMax <= 0) return;
    peeked.current = true;
    if (lessonRef.current === 'play') return; // the lesson shows the menu its own way
    const a = setTimeout(() => scrollTrayTo(Math.min(layout.scrollMax, layout.W * 0.32), 700), 1400);
    const b = setTimeout(() => { if (Date.now() - lastTouch.current > 1500) scrollTrayTo(0, 700); }, 3000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [ready, layout.scrollMax]);
  useEffect(() => () => cancelAnimationFrame(scrollAnim.current), []);

  const onStageCount = session.state.spots.filter(Boolean).length;
  const row = rtl ? 'row-reverse' : 'row';

  return (
    <AccentContext.Provider value={stage.palette.glow}>
    <View style={styles.root}>
      <SceneCanvas sv={sv} width={width} height={height} />
      <View style={StyleSheet.absoluteFill} onTouchStart={touchFn('start')} onTouchMove={touchFn('move')} onTouchEnd={touchFn('end')} onTouchCancel={touchFn('cancel')} />

      {lesson === 'play' && (
        <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 6, left: insets.left + 10, right: insets.right + 10, flexDirection: row, justifyContent: 'space-between' }]}>
          <IconButton icon="back" label={t('a11y.back')} onPress={onBack} />
          {progress.lessonsDone.length > 0 ? <IconButton icon="next" label={t('a11y.lessonSkip')} onPress={skipLesson} /> : <View />}
        </View>
      )}
      {lesson !== 'play' && <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 6, left: insets.left + 10, right: insets.right + 10, flexDirection: row }]}>
        <IconButton icon="back" label={t('a11y.back')} onPress={onBack} />
        <Pressable style={styles.world} accessibilityRole="button" accessibilityLabel={t(stage.nameKey as StringKey)} hitSlop={6} onPress={() => { if (!recording) setWorlds((v) => !v); }}><WorldIcon stageId={stage.id} size={34} /></Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}><StageHud stage={stage} state={session.state} discovered={progress.discoveredCombos} compact={width < 700} row={row} /></View>
        <View style={{ flexDirection: row, gap: 10, alignItems: 'center' }}>
          {recording && (() => {
            const secs = Math.round(recBars * barSec(stage.bpm));
            const warn = recBars >= warnBars(stage.bpm);
            return <Text style={[styles.rec, warn && styles.recWarn]} accessibilityLabel={t(secs === 1 ? 'a11y.recordingTime.one' : 'a11y.recordingTime', { n: secs })}>{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</Text>;
          })()}
          <View><RecordPulse on={recordCue && !recording} /><IconButton primary icon={recording ? 'stop' : 'record'} label={recording ? t('a11y.stopRecord') : t('a11y.record')} caption={recording ? t('ui.stop') : t('ui.record')} color={recording ? '#FFFFFF' : COLORS.rec} bg={recording ? COLORS.rec : undefined} onPress={onRecord} /></View>
          <IconButton icon="combos" label={t('a11y.comboBook')} caption={t('ui.combos')} onPress={() => setBook(true)} />
          <IconButton icon="note" label={t('a11y.songs')} caption={t('ui.songs')} onPress={onSongs} />
          <IconButton icon="help" label={t('a11y.help')} caption={t('ui.help')} onPress={onHelp} />
        </View>
      </View>}
      {lesson !== 'play' && <View pointerEvents="box-none" style={[styles.clear, { left: insets.left + 14, top: layout.stageH - 84 }]}>
        <IconButton icon="dice" label={t('a11y.surprise')} caption={t('ui.surprise')} onPress={() => {
          const l = layoutRef.current;
          for (const id of session.state.spots) if (id) goBackAll(id, l.spots[session.state.spots.indexOf(id)]!);
          session.dispatch({ kind: 'clear' });
          randomBand(stage).forEach((id, spot) => {
            anim.set(id, { since: now() + spot * 90, from: l.slotPos[stage.creatures.findIndex((c) => c.id === id)]! });
            session.dispatch({ kind: 'drop', creatureId: id, spot });
          });
          engine.playSfx('goal');
          syncScene();
        }} />
      </View>}
      {lesson !== 'play' && <View pointerEvents="box-none" style={[styles.clear, { right: insets.right + 14, top: layout.stageH - 84 }]}>
        {onStageCount > 0 && <IconButton icon="sweep" label={t('a11y.clear')} caption={t('ui.clear')} onPress={() => {
          const l = layoutRef.current;
          for (const id of session.state.spots) if (id) { const s = session.state.spots.indexOf(id); goBackAll(id, l.spots[s]!); }
          session.dispatch({ kind: 'clear' });
          syncScene();
        }} />}
      </View>}

      {book && <ComboBook stage={stage} session={session} discovered={progress.discoveredCombos} onClose={() => setBook(false)} onReplay={(id) => { setBook(false); session.replayCombo(id); }} />}
      {screenReader && ready && (
        <>
          <ScrollView horizontal style={[styles.srTray, { top: layout.tray.y, height: layout.tray.h }]} contentContainerStyle={{ alignItems: 'center' }}>
            {stage.creatures.map((c, i) => {
              const on = session.state.spots.includes(c.id);
              const lay = t(`layer.${c.layer}` as StringKey), num = (i % TUNING.perLayer) + 1;
              const label = on ? t('a11y.singerOnStage', { layer: lay, n: num }) : t('a11y.creature', { layer: lay, n: num });
              return <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={label} style={styles.srBtn}
                onPress={() => (on ? (session.dispatch({ kind: 'remove', creatureId: c.id }), syncScene()) : apply({ type: 'trayTap', creatureId: c.id }))} />;
            })}
          </ScrollView>
          {lesson !== 'play' && session.state.spots.map((id, spot) => {
            if (!id) return null;
            const c = stage.creatures.find((q) => q.id === id)!;
            const sp = layout.spots[spot]!;
            const label = t('a11y.singerOnStage', { layer: t(`layer.${c.layer}` as StringKey), n: (stage.creatures.indexOf(c) % TUNING.perLayer) + 1 });
            const level = Math.round((session.state.volume[id] ?? 1) * 100);
            return (
              <Pressable key={id} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: `${level}%${session.state.muted[id] ? ', ' + t('a11y.muted') : ''}` }}
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
      {worlds && !recording && (
        <View style={[styles.worlds, { top: insets.top + 6 + 64, [rtl ? 'right' : 'left']: (rtl ? insets.right : insets.left) + 10 + 56 + 10 }]}>
          {STAGES.filter((st) => st.id !== stage.id).map((st) => {
            const locked = !FREE_STAGE_IDS.includes(st.id) && !progress.unlocked;
            return (
              <Pressable key={st.id} accessibilityRole="button" accessibilityLabel={`${t(st.nameKey as StringKey)}${locked ? ', ' + t('select.locked') : ''}`} hitSlop={4}
                onPress={() => { setWorlds(false); if (st.id === stage.id) return; if (locked) onLocked(st.id); else onSwitch(st.id); }}
                style={[styles.world, { marginHorizontal: 0, width: 46, height: 46, borderRadius: 23, opacity: locked ? 0.55 : 1 }]}>
                <WorldIcon stageId={st.id} size={30} />
                {locked && <View style={styles.wlock}><Icon name="lock" size={14} color="#FFE8A3" /></View>}
              </Pressable>
            );
          })}
        </View>
      )}
      {lesson === 'play' && lessonDir !== 0 && <TrayArrow side={lessonDir > 0 ? 'right' : 'left'} y={layout.tray.y + layout.tray.h / 2} offset={(lessonDir > 0 ? insets.right : insets.left) + 6} label={t(lessonDir > 0 ? 'a11y.trayRight' : 'a11y.trayLeft')} onPress={scrollToLit} />}
      {lesson !== 'play' && (edges.left || edges.right) && (
        <>
          {edges.left && <TrayArrow side="left" y={layout.tray.y + layout.tray.h / 2} offset={insets.left + 6} label={t('a11y.trayLeft')} onPress={() => scrollTrayTo(sv.scrollX.value - layout.W * 0.7)} />}
          {edges.right && <TrayArrow side="right" y={layout.tray.y + layout.tray.h / 2} offset={insets.right + 6} label={t('a11y.trayRight')} onPress={() => scrollTrayTo(sv.scrollX.value + layout.W * 0.7)} />}
        </>
      )}
      {toast && (
        <View pointerEvents="none" accessibilityLiveRegion="polite" accessibilityLabel={toast.text} style={[styles.toast, { top: insets.top + 6 + 80 }]}>
          {toast.icons.map((n, i) => <Icon key={i} name={n} size={30} color="#2A1F00" />)}
          {toast.text ? <Text style={styles.toastText}>{toast.text}</Text> : null}
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
            {(exportMsg === 'storage' || exportMsg === 'error' || exportMsg === 'unavailable') && <Text style={styles.fail}>{t(exportMsg === 'storage' ? 'songs.storageFull' : 'songs.exportError')}</Text>}
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
      {lesson === 'done' && <LessonDone onNext={() => setLesson(null)} />}
      {gate}
      {paused && (
        <View style={styles.overlay}>
          <IconButton icon="play" label={t('a11y.play')} size={96} onPress={() => { engine.resume(); setPaused(false); }} />
        </View>
      )}
    </View>
    </AccentContext.Provider>
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
  worlds: { position: 'absolute', gap: 6, zIndex: 5 },
  wlock: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(27,19,64,0.96)', alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFE8A3', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, elevation: 6 },
  toastText: { color: '#2A1F00', fontSize: 20, fontWeight: '800' },
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
