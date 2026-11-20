import { describe, expect, it } from 'vitest';
import { comboProgress, initialTracker, matchingCombos, stepTracker } from '../src/core/combos';
import { emptyStage, reduceStage as r } from '../src/core/stageState';
import type { Combo } from '../src/core/types';

const combo: Combo = { id: 'c1', creatureIds: ['a', 'b', 'c', 'd'], bonusLoopFile: 'x.m4a', celebrationId: 'cel1' };
const full = ['a', 'b', 'c', 'd'].reduce((s, id, i) => r(s, { kind: 'drop', creatureId: id, spot: i }), emptyStage());

describe('combos', () => {
  it('matches only when all four are on stage, unmuted, and nobody solos', () => {
    expect(matchingCombos([combo], full)).toHaveLength(1);
    expect(matchingCombos([combo], r(full, { kind: 'mute', creatureId: 'a' }))).toHaveLength(0);
    expect(matchingCombos([combo], r(full, { kind: 'solo', creatureId: 'a' }))).toHaveLength(0);
  });
  it('hint counts creatures present', () => {
    expect(comboProgress(combo, emptyStage())).toBe(0);
    expect(comboProgress(combo, r(emptyStage(), { kind: 'drop', creatureId: 'c', spot: 0 }))).toBe(1);
    expect(comboProgress(combo, full)).toBe(4);
  });
  it('celebration starts after a full loop held, on a loop boundary, lasts 8 bars', () => {
    let t = initialTracker();
    let startedAt = -1;
    let endedAt = -1;
    for (let bar = 0; bar < 20; bar++) {
      const res = stepTracker(t, bar, [combo]);
      t = res.state;
      if (res.started) startedAt = bar;
      if (res.ended) endedAt = bar;
    }
    expect(startedAt).toBe(3); // bars 0..3 held = one loop, starts for bar 4
    expect(endedAt - startedAt).toBe(8);
  });
  it('breaking the combo resets the wait', () => {
    let t = initialTracker();
    for (let bar = 0; bar < 3; bar++) t = stepTracker(t, bar, [combo]).state;
    t = stepTracker(t, 3, []).state;
    expect(t.heldBars).toBe(0);
    for (let bar = 4; bar < 7; bar++) {
      const res = stepTracker(t, bar, [combo]);
      expect(res.started).toBeNull();
      t = res.state;
    }
  });
});
