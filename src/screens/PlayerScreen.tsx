import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEngine } from '../audio';
import { getStage } from '../content';
import { exportSong } from '../app/exportSong';
import { useProgress } from '../app/progress';
import { computeLayout } from '../core/layout';
import { songProvider } from '../core/session';
import { stateAtBar, type Song } from '../core/timeline';
import { TUNING } from '../core/tuning';
import { comboStartsAt } from '../core/timeline';
import { t } from '../i18n';
import { useLang } from '../i18n/useLang';
import { IconButton } from '../ui/IconButton';
import { SceneCanvas, useSceneValues } from '../ui/SceneCanvas';
import { COLORS } from '../ui/theme';

/** Replays a recorded song: audio and stage animation are both re-rendered from the event timeline. */
export function PlayerScreen({ song, onBack }: { song: Song; onBack: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { rtl } = useLang();
  const { progress } = useProgress();
  const stage = useMemo(() => getStage(song.stageId), [song.stageId]);
  const engine = useMemo(() => getEngine(), []);
  const layout = useMemo(() => computeLayout(width, height, undefined, Math.max(insets.left, insets.right) + 8, insets.top + 66), [width, height, insets.left, insets.right, insets.top]);
  const sv = useSceneValues(stage, layout, progress.settings.reduceMotion);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const prev = useRef<Set<string>>(new Set());

  const play = () => {
    const provider = songProvider(stage, song);
    prev.current = new Set();
    engine.start(stage.bpm, (bar) => {
      const state = stateAtBar(song, bar);
      const now = sv.timeMs.value;
      sv.placed.value = state.spots.flatMap((id, spot) => {
        if (!id) return [];
        const isNew = !prev.current.has(id);
        return [{ id, spot, since: isNew ? now : -1e6, from: layout.slotPos[stage.creatures.findIndex((c) => c.id === id)] ?? layout.spots[spot]! }];
      });
      prev.current = new Set(state.spots.filter((x): x is string => !!x));
      sv.muted.value = state.muted;
      sv.solo.value = state.solo;
      const cid = comboStartsAt(song, bar);
      if (cid) {
        const combo = stage.combos.find((c) => c.id === cid)!;
        sv.celebration.value = { celebrationId: combo.celebrationId, creatureIds: combo.creatureIds as unknown as string[], startBeat: bar * TUNING.beatsPerBar };
      } else if (sv.celebration.value && bar * TUNING.beatsPerBar - sv.celebration.value.startBeat >= TUNING.celebrationBars * TUNING.beatsPerBar) sv.celebration.value = null;
      if (bar > song.bars) { setTimeout(() => { engine.stop(); setPlaying(false); sv.placed.value = []; sv.celebration.value = null; }, 0); }
      return provider(bar);
    });
    setPlaying(true);
  };

  useEffect(() => {
    let alive = true;
    void (async () => { await engine.init(); await engine.loadStage(stage); if (alive) { setReady(true); play(); } })();
    let raf = 0;
    const loop = () => { if (engine.state === 'running') sv.beat.value = engine.positionBeats(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); engine.stop(); };
  }, []);

  const row = rtl ? 'row-reverse' : 'row';
  return (
    <View style={styles.root}>
      <SceneCanvas sv={sv} width={width} height={height} />
      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 6, left: insets.left + 10, right: insets.right + 10, flexDirection: row }]}>
        <IconButton icon="back" label={t('a11y.back')} onPress={onBack} />
      </View>
      <View pointerEvents="box-none" style={[styles.bar, { bottom: insets.bottom + 10, flexDirection: row }]}>
        <IconButton icon={playing ? 'pause' : 'play'} label={playing ? t('a11y.pause') : t('a11y.play')} size={72} onPress={() => { if (playing) { engine.stop(); setPlaying(false); } else play(); }} />
        <IconButton icon="share" label={t('a11y.share')} onPress={() => void exportSong(engine, stage, song)} />
      </View>
      {!ready && <View style={StyleSheet.absoluteFill} />}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky },
  top: { position: 'absolute', alignItems: 'center' },
  bar: { position: 'absolute', alignSelf: 'center', gap: 20, alignItems: 'center' },
});
