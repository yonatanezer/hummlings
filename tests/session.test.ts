import { describe, expect, it } from 'vitest';
import { MockEngine } from '../src/audio/mock';
import { Session, songProvider } from '../src/core/session';
import { buildStage } from '../scripts/build-content';
import { stateAtBar } from '../src/core/timeline';

const stage = buildStage(0);
const combo = stage.combos[0]!;

function setup() {
  const engine = new MockEngine();
  const events: string[] = [];
  const s = new Session(stage, engine, { onCelebration: (id, bar) => events.push(`cel:${id}@${bar}`), onCelebrationEnd: () => events.push('end') });
  s.start();
  return { engine, s, events };
}

describe('session', () => {
  it('empty stage ticks; a drop is audible only from the next bar boundary', () => {
    const { engine, s } = setup();
    expect(engine.plans[0]!.tick).toBe('soft');
    s.dispatch({ kind: 'drop', creatureId: stage.creatures[0]!.id, spot: 0 });
    expect(engine.plans[0]!.ids).toEqual([]); // bar 0 already planned
    engine.advanceBars(1);
    expect(engine.plans[1]!.ids).toEqual([stage.creatures[0]!.id]);
    expect(engine.plans[1]!.tick).toBe('off');
  });
  it('rapid add/remove within a bar: only the boundary state sounds', () => {
    const { engine, s } = setup();
    const id = stage.creatures[1]!.id;
    s.dispatch({ kind: 'drop', creatureId: id, spot: 2 });
    s.dispatch({ kind: 'remove', creatureId: id });
    engine.advanceBars(1);
    expect(engine.plans[1]!.ids).toEqual([]);
  });
  it('combo: celebration after a full loop, bonus loop for 8 bars, discovered once, re-fire needs a break', () => {
    const { engine, s, events } = setup();
    combo.creatureIds.forEach((id, i) => s.dispatch({ kind: 'drop', creatureId: id, spot: i }));
    engine.advanceBars(40);
    expect(events[0]).toBe('cel:' + combo.id + '@8');
    expect(engine.plans[8]!.bonusFile).toBe(combo.bonusLoopFile);
    expect(engine.plans[15]!.bonusFile).toBe(combo.bonusLoopFile);
    expect(engine.plans[16]!.bonusFile).toBeNull();
    expect(events.filter((e) => e.startsWith('cel'))).toHaveLength(1);
    expect(s.isDiscovered(combo.id)).toBe(true);
  });
  it('recording replays to the same audible sets bar by bar', () => {
    const { engine, s } = setup();
    engine.advanceBars(2);
    s.startRecording();
    const [a, b] = [stage.creatures[0]!.id, stage.creatures[5]!.id];
    s.dispatch({ kind: 'drop', creatureId: a, spot: 0 });
    engine.advanceBars(2);
    s.dispatch({ kind: 'drop', creatureId: b, spot: 1 });
    s.dispatch({ kind: 'mute', creatureId: a });
    engine.advanceBars(3);
    const song = s.stopRecording({ id: 's1', name: 'Song 1', createdAt: 0 })!;
    const provider = songProvider(stage, song);
    for (let bar = 0; bar < song.bars; bar++) {
      const live = engine.plans[bar + 3]!; // recording started at bar 3
      expect(provider(bar).ids, `bar ${bar}`).toEqual(live.ids);
    }
    expect(stateAtBar(song, song.bars - 1).spots[1]).toBe(b);
  });
});

describe('combo replay', () => {
  it('puts the four creatures on stage and celebrates at the next loop boundary', () => {
    const engine = new MockEngine();
    const starts: number[] = [];
    const s = new Session(stage, engine, { onCelebration: (_id, bar) => starts.push(bar) });
    s.start();
    engine.advanceBars(1);
    s.replayCombo(combo.id);
    expect(Object.keys(s.state.spots.filter(Boolean)).length).toBe(4);
    engine.advanceBars(10);
    expect(starts).toEqual([4]);
    expect(engine.plans[4]!.bonusFile).toBe(combo.bonusLoopFile);
  });
});

describe('volume in session and export', () => {
  it('reaches the engine at once, the next plan, the recording and the offline render', async () => {
    const engine = new MockEngine();
    const s = new Session(stage, engine, {});
    s.start();
    const id = stage.creatures[0]!.id;
    s.dispatch({ kind: 'drop', creatureId: id, spot: 0 });
    engine.advanceBars(1);
    s.startRecording();
    s.dispatch({ kind: 'volume', creatureId: id, value: 0.5 });
    s.dispatch({ kind: 'volume', creatureId: id, value: 0.25 });
    expect(engine.voiceGains[id]).toBe(0.25);
    engine.advanceBars(1);
    expect(engine.plans[2]!.gains[id]).toBe(0.25);
    const song = s.stopRecording({ id: 'v', name: 'v', createdAt: 0 })!;
    expect(song.events.filter((e) => 'action' in e && e.action.kind === 'volume')).toHaveLength(1); // coalesced
    const { renderSong, samplesPerBar } = await import('../src/core/render');
    const spb = samplesPerBar(stage.bpm);
    const bank = { [stage.creatures[0]!.loopFile]: new Float32Array(spb * 4).fill(0.4) };
    const full = renderSong(stage, { ...song, events: song.events.filter((e) => !('action' in e && e.action.kind === 'volume')) }, bank).samples;
    const quiet = renderSong(stage, song, bank).samples;
    const mid = Math.floor(song.bars * spb * 0.5);
    expect(quiet[mid]! / full[mid]!).toBeCloseTo(0.25, 2);
  });
});

describe('reward countdown', () => {
  it('appears while a complete combo is held, points at the exact start of the celebration, and disappears when it is broken', () => {
    const engine = new MockEngine();
    const s = new Session(stage, engine, {});
    s.start();
    combo.creatureIds.forEach((id, i) => s.dispatch({ kind: 'drop', creatureId: id, spot: i }));
    engine.advanceBars(2);
    expect(s.reward).toMatchObject({ comboId: combo.id, startBeat: 32 }); // the celebration really starts at bar 8
    engine.advanceBars(3);
    expect(s.reward!.startBeat).toBe(32);
    s.dispatch({ kind: 'mute', creatureId: combo.creatureIds[0] });
    engine.advanceBars(2);
    expect(s.reward).toBeNull();
  });
});
