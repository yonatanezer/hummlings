import { describe, expect, it } from 'vitest';
import { computeLayout, inRect, popupRects, slotAt, spotAt, standingAt } from '../src/core/layout';
import { HERO_COUNT, HERO_NOTES, HERO_PICKS, heroGeometry, heroHitTest, paddedGeo } from '../src/core/hero';
import { COACH_IDLE_MS, pickSlot, pickSpot } from '../src/core/coach';
import { TUNING } from '../src/core/tuning';

const SIZES: [string, number, number, number, number][] = [
  ['small phone', 640, 360, 0, 0],
  ['phone', 844, 390, 0, 0],
  ['phone with insets', 915, 412, 48, 56],
  ['big phone', 932, 430, 0, 0],
  ['tablet', 1180, 820, 0, 0],
  ['tablet 2', 1280, 800, 0, 0],
  ['large', 2000, 1200, 0, 0],
  ['portrait phone', 390, 844, 0, 0],
  ['portrait tablet', 600, 1000, 0, 0],
];

describe('layout invariants across screen sizes', () => {
  for (const [name, W, H, padX, top] of SIZES) {
    const l = computeLayout(W, H, undefined, padX, top);
    it(`${name} (${W}x${H}): regions tile the screen and targets are big enough`, () => {
      expect(l.stageH + l.tray.h).toBeCloseTo(H, 5);
      expect(l.size).toBeGreaterThanOrEqual(TUNING.minTouchPt);
      l.spots.forEach((s) => { expect(s.x).toBeGreaterThan(0); expect(s.x).toBeLessThan(W); expect(s.y).toBeGreaterThan(0); expect(s.y).toBeLessThan(l.stageH); });
      l.slotPos.forEach((s) => { expect(s.y).toBeGreaterThan(l.tray.y); expect(s.y).toBeLessThan(l.tray.y + l.tray.h); });
    });
    it(`${name}: scrollMax is exactly the overflow of the singer row`, () => {
      expect(l.scrollMax).toBeCloseTo(Math.max(0, l.trayContentW - W), 5);
      const last = l.slotPos[l.slotPos.length - 1]!;
      expect(last.x + l.slot / 2 - l.scrollMax).toBeLessThanOrEqual(W + 1); // the last singer can be scrolled fully into view
      if (l.scrollMax > 0) expect(l.slot).toBeGreaterThanOrEqual(TUNING.minTouchPt); // phones keep touch targets big and scroll
    });
    it(`${name}: every spot hit-tests to itself and the last tray slot is reachable at full scroll`, () => {
      l.spots.forEach((s, i) => expect(spotAt(l, { x: s.x, y: s.y - l.size / 2 })).toBe(i));
      const last = l.slotPos.length - 1;
      const p = l.slotPos[last]!;
      expect(slotAt(l, { x: p.x - l.scrollMax, y: p.y }, l.scrollMax)).toBe(last);
      expect(slotAt(l, { x: p.x, y: l.tray.y - 30 }, 0)).toBe(-1); // above the tray
    });
    it(`${name}: the volume popup stays on screen for every spot, and its controls sit inside it`, () => {
      l.spots.forEach((_, i) => {
        const r = popupRects(l, i);
        expect(r.panel.x).toBeGreaterThanOrEqual(-0.5);
        expect(r.panel.x + r.panel.w).toBeLessThanOrEqual(W + 0.5);
        expect(r.panel.y).toBeGreaterThanOrEqual(-0.5);
        for (const c of [r.slider, r.solo]) {
          expect(c.x).toBeGreaterThanOrEqual(r.panel.x - 0.5);
          expect(c.x + c.w).toBeLessThanOrEqual(r.panel.x + r.panel.w + 0.5);
          expect(c.y).toBeGreaterThanOrEqual(r.panel.y - 0.5);
          expect(c.y + c.h).toBeLessThanOrEqual(r.panel.y + r.panel.h + 0.5);
        }
      });
    });
  }
  it('standingAt ignores empty spots and only accepts points near the body', () => {
    const l = computeLayout(844, 390);
    const s = l.spots[2]!;
    const body = { x: s.x, y: s.y - l.size * 0.5 };
    const occ = [false, false, true, false, false, false];
    expect(standingAt(l, body, occ)).toBe(2);
    expect(standingAt(l, body, [false, false, false, false, false, false])).toBe(-1);
    expect(standingAt(l, { x: s.x + l.size * 2, y: s.y - l.size * 0.5 }, occ)).not.toBe(2);
  });
  it('inRect counts the edges as inside', () => {
    const r = { x: 10, y: 20, w: 30, h: 40 };
    expect(inRect(r, { x: 10, y: 20 })).toBe(true);
    expect(inRect(r, { x: 40, y: 60 })).toBe(true);
    expect(inRect(r, { x: 40.1, y: 60 })).toBe(false);
  });
  it('the popup is nudged down on a tiny canvas instead of leaving the top of the screen', () => {
    const l = computeLayout(360, 200);
    l.spots.forEach((_, i) => expect(popupRects(l, i).panel.y).toBeGreaterThanOrEqual(-0.5));
  });
});

describe('hero singers on the home screen', () => {
  const heroSizes: [number, number][] = [[320, 240], [844, 390], [1180, 820], [2000, 1200]];
  for (const [W, H] of heroSizes) {
    it(`${W}x${H}: singers are inside the safe area, never both hit, and a gap hits nothing`, () => {
      const g = heroGeometry(W, H, 56, 24, 40);
      expect(g.xs).toHaveLength(HERO_COUNT);
      g.xs.forEach((x, i) => { expect(x).toBeGreaterThanOrEqual(24); expect(x).toBeLessThanOrEqual(W - 40); if (i) expect(x).toBeGreaterThan(g.xs[i - 1]!); });
      g.xs.forEach((x, i) => expect(heroHitTest(g, x, g.ys[i]! - g.S * 0.5)).toBe(i));
      expect(heroHitTest(g, 1, 1)).toBe(-1); // a corner of the screen hits nobody
    });
  }
  it('notes ascend and picks stay inside the creature list', () => {
    HERO_NOTES.forEach((n, i) => { if (i) expect(n).toBeGreaterThan(HERO_NOTES[i - 1]!); });
    expect(HERO_NOTES).toHaveLength(HERO_COUNT);
    expect(HERO_PICKS).toHaveLength(HERO_COUNT);
    HERO_PICKS.forEach((p) => { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThan(24); });
  });
  it('paddedGeo moves the singers down by exactly the headroom it adds', () => {
    const g = heroGeometry(844, 390, 56, 0, 0);
    const { geo, pad } = paddedGeo(g, 300);
    geo.ys.forEach((y, i) => expect(y - pad).toBeCloseTo(g.ys[i]!, 5));
  });
});

describe('coach edge cases', () => {
  it('idle thresholds grow with how much the child already knows', () => {
    const t = COACH_IDLE_MS;
    expect(t.more).toBeLessThan(t.tap);
    expect(t.tap).toBeLessThan(t.hold);
    expect(t.hold).toBeLessThan(t.record);
    expect(t.record).toBeLessThan(t.again);
  });
  it('pickSlot falls back to something valid when everything is on stage or off screen', () => {
    const ids = ['a', 'b', 'c'];
    expect(pickSlot(ids, new Set(ids), [10, 20, 30], 800)).toBeGreaterThanOrEqual(0);
    expect(pickSlot(ids, new Set(), [-100, 5000, 200], 800)).toBe(2);
    expect(pickSlot([], new Set(), [], 800)).toBeGreaterThanOrEqual(0);
  });
  it('pickSpot fills the stage from the middle and never returns an occupied spot', () => {
    const spots: (string | null)[] = [null, null, null, null, null, null];
    const taken: number[] = [];
    for (let k = 0; k < 6; k++) { const s = pickSpot(spots); expect(spots[s]).toBeNull(); spots[s] = 'x'; taken.push(s); }
    expect(new Set(taken).size).toBe(6);
  });
});
