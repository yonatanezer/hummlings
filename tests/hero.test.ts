import { describe, expect, it } from 'vitest';
import { HERO_COUNT, HERO_NOTES, HERO_PICKS, heroGeometry, heroHitTest } from '../src/ui/draw/hero';
import { STAGES } from '../src/content';

describe('home singers', () => {
  const sizes: [number, number, number, number][] = [[844, 390, 0, 0], [915, 412, 24, 48], [667, 375, 0, 0], [390, 844, 0, 0], [1180, 820, 0, 0]];

  it('stand in a row inside the screen, left to right, all the same size', () => {
    for (const [w, h, l, r] of sizes) {
      const g = heroGeometry(w, h, 90, l, r);
      expect(g.xs).toHaveLength(HERO_COUNT);
      g.xs.forEach((x, i) => {
        expect(x).toBeGreaterThan(l);
        expect(x).toBeLessThan(w - r);
        if (i) expect(x).toBeGreaterThan(g.xs[i - 1]!);
      });
      expect(g.S).toBeGreaterThan(30);
      g.ys.forEach((y) => { expect(y).toBeLessThan(g.height); expect(y).toBeGreaterThan(g.S * 0.8); });
    }
  });

  it('leave room for the world cards below on a phone held sideways', () => {
    const g = heroGeometry(844, 390, 90, 0, 0);
    expect(g.top + g.height).toBeLessThan(390 * 0.65);
  });

  it('are hit by a touch on their body and not by a touch between or far above them', () => {
    const g = heroGeometry(844, 390, 90, 0, 0);
    g.xs.forEach((x, i) => expect(heroHitTest(g, x, g.ys[i]! - g.S * 0.5)).toBe(i));
    expect(heroHitTest(g, (g.xs[0]! + g.xs[1]!) / 2 + g.S * 0.0, 0)).toBe(-1);
    expect(heroHitTest(g, g.xs[2]!, -400)).toBe(-1);
  });

  it('sing a rising scale and exist in the first world', () => {
    expect(HERO_NOTES).toHaveLength(HERO_COUNT);
    HERO_NOTES.forEach((n, i) => { if (i) expect(n).toBeGreaterThan(HERO_NOTES[i - 1]!); });
    expect(HERO_PICKS).toHaveLength(HERO_COUNT);
    expect(new Set(HERO_PICKS).size).toBe(HERO_COUNT);
    HERO_PICKS.forEach((i) => expect(STAGES[0]!.creatures[i]).toBeTruthy());
  });
});
