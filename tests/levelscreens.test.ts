import { describe, expect, it } from 'vitest';
import { doneCoinRow, doneLayout, introLayout, mapLayout } from '../src/core/levelscreens';

const SIZES: [number, number][] = [[844, 390], [667, 375], [932, 430], [568, 320], [1180, 820]];

describe('level map layout', () => {
  it.each(SIZES)('keeps every circle on screen and apart (%i x %i)', (W, H) => {
    for (const rtl of [false, true]) {
      const L = mapLayout(W, H, 5, rtl);
      const all = [...L.nodes, L.free];
      for (const p of all) {
        expect(p.x - p.r).toBeGreaterThanOrEqual(0);
        expect(p.x + p.r).toBeLessThanOrEqual(W);
        expect(p.y - p.r * 2.2).toBeGreaterThan(L.coins.y + L.coins.h - 10); // room for the mascot above, below the coin pill
        expect(p.y + p.r * 1.9).toBeLessThan(H); // the stars under a finished circle
      }
      for (let i = 1; i < all.length; i++) expect(Math.hypot(all[i]!.x - all[i - 1]!.x, all[i]!.y - all[i - 1]!.y)).toBeGreaterThan((all[i]!.r + all[i - 1]!.r) * 1.15);
    }
  });
  it('starts on the right in a right-to-left language and ends at free play', () => {
    const ltr = mapLayout(844, 390, 5, false), rtl = mapLayout(844, 390, 5, true);
    expect(ltr.nodes[0]!.x).toBeLessThan(ltr.nodes[4]!.x);
    expect(rtl.nodes[0]!.x).toBeGreaterThan(rtl.nodes[4]!.x);
    expect(ltr.free.x).toBeGreaterThan(ltr.nodes[4]!.x);
    expect(rtl.free.x).toBeLessThan(rtl.nodes[4]!.x);
    expect(rtl.back.x).toBeGreaterThan(844 / 2);
  });
});

describe('success card layout', () => {
  it.each(SIZES)('fits the screen and holds its parts (%i x %i)', (W, H) => {
    const D = doneLayout(W, H);
    expect(D.card.x).toBeGreaterThanOrEqual(0);
    expect(D.card.x + D.card.w).toBeLessThanOrEqual(W);
    expect(D.ribbon.y).toBeGreaterThanOrEqual(0);
    expect(D.card.y + D.card.h).toBeLessThanOrEqual(H);
    for (const s of D.stars) { expect(s.y - s.r).toBeGreaterThan(D.card.y); expect(s.y + s.r).toBeLessThan(D.coinsY); }
    expect(D.button.y + D.button.r).toBeLessThan(D.card.y + D.card.h);
    expect(D.button.y - D.button.r).toBeGreaterThan(D.coinsY);
    const row = doneCoinRow(D.card, D.countX, D.u, 4);
    expect(row.x0).toBeGreaterThan(D.card.x);
    expect(row.endX + 70 * D.u).toBeLessThan(D.card.x + D.card.w);
  });
  it('puts the level banner under the coin counter, over the stage', () => {
    const B = introLayout(844, 285);
    expect(B.y).toBeGreaterThan(60);
    expect(B.y + B.h).toBeLessThan(285);
    expect(B.x).toBeGreaterThan(0);
  });
});
