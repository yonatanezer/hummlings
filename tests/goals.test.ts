import { describe, expect, it } from 'vitest';
import { MockEngine } from '../src/audio/mock';
import { GoalTracker } from '../src/core/goals';
import { Session } from '../src/core/session';
import { emptyStage, reduceStage as r } from '../src/core/stageState';
import { buildStage } from '../scripts/build-content';

const stage = buildStage(0);
const ofLayer = (layer: string, n = 0) => stage.creatures.filter((c) => c.layer === layer)[n]!.id;

describe('goals (stickers)', () => {
  it('full band needs all four layers audible; muting one breaks it', () => {
    const g = new GoalTracker(stage);
    let s = emptyStage();
    ['drums', 'bass', 'melody'].forEach((l, i) => { s = r(s, { kind: 'drop', creatureId: ofLayer(l), spot: i }); });
    expect(g.check(s, 0)).toEqual([]);
    s = r(s, { kind: 'drop', creatureId: ofLayer('voice'), spot: 3 });
    expect(g.check(s, 0)).toEqual(['pond:fullBand']);
    expect(g.check(s, 0)).toEqual([]); // earned once
  });
  it('drum circle, choir, full stage', () => {
    const g = new GoalTracker(stage);
    let s = emptyStage();
    for (let i = 0; i < 3; i++) s = r(s, { kind: 'drop', creatureId: ofLayer('drums', i), spot: i });
    expect(g.check(s, 0)).toContain('pond:drumCircle');
    for (let i = 0; i < 3; i++) s = r(s, { kind: 'drop', creatureId: ofLayer('voice', i), spot: 3 + i });
    const fresh = g.check(s, 0);
    expect(fresh).toContain('pond:choir');
    expect(fresh).toContain('pond:fullStage');
  });
  it('counters: mute toggles, swaps, solo of every layer, combos', () => {
    const g = new GoalTracker(stage);
    let s = emptyStage();
    const act = (a: Parameters<typeof r>[1]) => { g.onAction(a, s); s = r(s, a); };
    ['drums', 'bass', 'melody', 'voice'].forEach((l, i) => act({ kind: 'drop', creatureId: ofLayer(l), spot: i }));
    for (let i = 0; i < 5; i++) act({ kind: 'mute', creatureId: ofLayer('drums') });
    expect(g.check(s, 0)).toContain('pond:mixMaster');
    for (const l of ['drums', 'bass', 'melody', 'voice']) { act({ kind: 'solo', creatureId: s.spots.find((id) => id && stage.creatures.find((c) => c.id === id)!.layer === l)! }); act({ kind: 'endSolo' }); }
    for (let i = 0; i < 3; i++) act({ kind: 'drop', creatureId: ofLayer('bass', 1 + i), spot: 0 });
    expect(g.check(s, 2)).toEqual(expect.arrayContaining(['pond:soloist', 'pond:swapper', 'pond:twoCombos']));
    
  });
  it('session reports earned stickers once and counts discovered combos', () => {
    const engine = new MockEngine();
    const got: string[] = [];
    const sess = new Session(stage, engine, { onGoal: (k) => got.push(k) });
    sess.start();
    ['drums', 'bass', 'melody', 'voice'].forEach((l, i) => sess.dispatch({ kind: 'drop', creatureId: ofLayer(l), spot: i }));
    engine.advanceBars(3);
    expect(got.filter((k) => k === 'pond:fullBand')).toHaveLength(1);
  });
});
