import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gearPath, ICON_NAMES, ICON_SHAPES, starPath } from '../src/core/uiIcons';
import { WORLD_ICONS } from '../src/core/worldIcons';

describe('interface icons', () => {
  it('give every icon at least one shape', () => {
    for (const n of ICON_NAMES) expect(ICON_SHAPES[n].length, n).toBeGreaterThan(0);
  });

  it('never repeat a glyph under two names (the clear button once was a copy of the download arrow)', () => {
    const seen = new Map<string, string>();
    for (const n of ICON_NAMES) {
      const key = JSON.stringify(ICON_SHAPES[n]);
      expect(seen.get(key), `${n} looks like ${seen.get(key)}`).toBeUndefined();
      seen.set(key, n);
    }
    // the specific pair that was confused: their paths must differ clearly, not by a pixel
    const a = JSON.stringify(ICON_SHAPES.sweep), b = JSON.stringify(ICON_SHAPES.download);
    expect(a).not.toContain('M12 4v1');
    expect(a).not.toBe(b);
  });

  it('draws a cog with eight teeth and a five-point star', () => {
    expect(gearPath(8).match(/L/g)!.length + 1).toBe(8 * 4);
    expect(starPath().match(/L/g)!.length + 1).toBe(10);
  });

  it('has a generated PNG entry for every icon and every world', () => {
    const map = readFileSync('src/ui/iconAssets.ts', 'utf8');
    for (const n of ICON_NAMES) expect(map, n).toContain(`  ${n}: require('../../assets/ui/icons/${n}.png')`);
    for (const id of Object.keys(WORLD_ICONS)) expect(map, id).toContain(`  ${id}: require('../../assets/ui/icons/world_${id}.png')`);
  });
});
