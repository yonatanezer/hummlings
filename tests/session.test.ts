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
