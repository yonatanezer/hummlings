import { describe, expect, it } from 'vitest';
import { audibleIds, emptyStage, reduceStage as r, onStage } from '../src/core/stageState';

describe('stage state', () => {
  it('drop puts a creature on a spot; moving it frees the old spot', () => {
    let s = r(emptyStage(), { kind: 'drop', creatureId: 'a', spot: 0 });
    s = r(s, { kind: 'drop', creatureId: 'a', spot: 3 });
    expect(s.spots[0]).toBeNull();
    expect(s.spots[3]).toBe('a');
  });
  it('dropping on an occupied spot sends the old creature back to the tray', () => {
    let s = r(emptyStage(), { kind: 'drop', creatureId: 'a', spot: 1 });
    s = r(s, { kind: 'drop', creatureId: 'b', spot: 1 });
    expect(onStage(s)).toEqual(['b']);
  });
  it('mute toggles and silences; solo silences everyone else', () => {
    let s = emptyStage();
    for (const [i, id] of ['a', 'b', 'c'].entries()) s = r(s, { kind: 'drop', creatureId: id, spot: i });
    s = r(s, { kind: 'mute', creatureId: 'b' });
    expect(audibleIds(s)).toEqual(['a', 'c']);
    s = r(s, { kind: 'solo', creatureId: 'b' });
    expect(audibleIds(s)).toEqual(['b']); // solo on a muted creature unmutes it
    expect(s.muted['b']).toBeUndefined();
    s = r(s, { kind: 'solo', creatureId: 'b' });
    expect(audibleIds(s)).toEqual(['a', 'b', 'c']);
  });
  it('removing the soloist ends the solo; clear empties everything', () => {
    let s = r(emptyStage(), { kind: 'drop', creatureId: 'a', spot: 0 });
    s = r(s, { kind: 'solo', creatureId: 'a' });
    s = r(s, { kind: 'remove', creatureId: 'a' });
    expect(s.solo).toBeNull();
    s = r(r(s, { kind: 'drop', creatureId: 'x', spot: 2 }), { kind: 'clear' });
    expect(onStage(s)).toEqual([]);
  });
  it('ignores invalid spots and actions on creatures not on stage', () => {
    const s = emptyStage();
    expect(r(s, { kind: 'drop', creatureId: 'a', spot: 9 })).toBe(s);
    expect(r(s, { kind: 'mute', creatureId: 'zzz' })).toBe(s);
  });
});
