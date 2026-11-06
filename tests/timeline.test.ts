import { describe, expect, it } from 'vitest';
import { Recorder, autoName, clampName, maxBars, stateAtBar, warnBars } from '../src/core/timeline';
import { emptyStage, reduceStage as r } from '../src/core/stageState';

describe('timeline', () => {
  it('max 3 minutes and 10 s warning', () => {
    expect(maxBars(96)).toBe(72); // 180 s * 96/60 / 4
    expect(maxBars(96) - warnBars(96)).toBeGreaterThanOrEqual(4);
  });
  it('records quantised events relative to start and replays the same state', () => {
    let live = r(emptyStage(), { kind: 'drop', creatureId: 'a', spot: 0 });
    const rec = new Recorder(10, 72, live);
    rec.action(12, { kind: 'drop', creatureId: 'b', spot: 1 });
    live = r(live, { kind: 'drop', creatureId: 'b', spot: 1 });
    rec.action(14, { kind: 'mute', creatureId: 'a' });
    live = r(live, { kind: 'mute', creatureId: 'a' });
    const song = rec.finish(18, { id: 's', name: 'x', stageId: 'pond', createdAt: 0 })!;
    expect(song.bars).toBe(8);
    expect(stateAtBar(song, 7)).toEqual(live);
    expect(stateAtBar(song, 1).spots[1]).toBeNull();
  });
  it('is saved up to the last full bar and refuses empty songs', () => {
    const rec = new Recorder(5, 72, emptyStage());
    expect(rec.finish(5, { id: 's', name: 'x', stageId: 'p', createdAt: 0 })).toBeNull();
    expect(rec.finish(200, { id: 's', name: 'x', stageId: 'p', createdAt: 0 })!.bars).toBe(72);
  });
  it('names', () => {
    expect(autoName(['Song 1', 'Song 2'])).toBe('Song 3');
    expect(clampName('  ' + 'a'.repeat(40))).toHaveLength(24);
  });
});
