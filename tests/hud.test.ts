import { describe, expect, it } from 'vitest';
import { hudModel } from '../src/core/hud';
import { emptyStage, reduceStage as r } from '../src/core/stageState';
import type { Stage } from '../src/core/types';

const cr = (id: string, layer: string) => ({ id, layer });
const stage = {
  creatures: [cr('d1', 'drums'), cr('b1', 'bass'), cr('m1', 'melody'), cr('v1', 'voice')],
  combos: [{ id: 'c1', creatureIds: ['d1', 'b1', 'm1', 'v1'] }, { id: 'c2', creatureIds: ['d1', 'b1', 'x', 'y'] }],
} as unknown as Stage;
const put = (ids: string[]) => ids.reduce((s, id, i) => r(s, { kind: 'drop', creatureId: id, spot: i }), emptyStage());

describe('hud model', () => {
  it('empty stage: nothing lit, nearest combo at 0', () => {
    const m = hudModel(stage, emptyStage(), []);
    expect(Object.values(m.layers).some(Boolean)).toBe(false);
    expect(m.best).toEqual({ have: 0 });
    expect([m.found, m.total]).toEqual([0, 2]);
  });
  it('lights only audible layers and counts the nearest combo', () => {
    const s = r(put(['d1', 'b1', 'm1']), { kind: 'mute', creatureId: 'm1' });
    const m = hudModel(stage, s, []);
    expect(m.layers).toEqual({ drums: true, bass: true, melody: false, voice: false });
    expect(m.best).toEqual({ have: 2 });
  });
  it('solo lights just the soloist and zeroes progress; found combos are skipped', () => {
    const m = hudModel(stage, r(put(['d1', 'b1']), { kind: 'solo', creatureId: 'd1' }), ['c1']);
    expect(m.layers.drums).toBe(true);
    expect(m.layers.bass).toBe(false);
    expect(m.best).toEqual({ have: 0 });
    expect(m.found).toBe(1);
  });
  it('all found: no progress pill content', () => {
    expect(hudModel(stage, emptyStage(), ['c1', 'c2']).best).toBeNull();
  });
});
