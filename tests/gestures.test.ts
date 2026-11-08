import { describe, expect, it } from 'vitest';
import { GestureTracker, type World } from '../src/core/gestures';
import { computeLayout, spotAt } from '../src/core/layout';

const layout = computeLayout(844, 390);
const ids = Array.from({ length: 24 }, (_, i) => `c${i}`);
const world = (onStage: (string | null)[] = [null, null, null, null, null, null], scrollX = 0): World => ({ layout, scrollX, trayIds: ids, onStage });

describe('layout', () => {
  it('spots are inside the stage area, ordered left to right, and every touch target >= 56', () => {
    layout.spots.forEach((s, i) => { expect(s.y).toBeLessThan(layout.stageH); if (i) expect(s.x).toBeGreaterThan(layout.spots[i - 1]!.x); });
    expect(layout.size).toBeGreaterThanOrEqual(56);
    expect(layout.slot).toBeGreaterThanOrEqual(56);
    const small = computeLayout(667, 375);
    expect(small.size).toBeGreaterThanOrEqual(56);
    expect(small.scrollMax).toBeGreaterThan(0); // phones scroll
    expect(computeLayout(1180, 820).scrollMax).toBeLessThan(small.scrollMax); // tablets scroll less (24 creatures)
  });
  it('spotAt picks the closest spot and rejects far points', () => {
    const s = layout.spots[2]!;
    expect(spotAt(layout, { x: s.x, y: s.y - layout.size / 2 })).toBe(2);
    expect(spotAt(layout, { x: 2, y: 2 })).toBe(-1);
  });
});

describe('gestures', () => {
  it('drag from tray to a spot drops there', () => {
    const g = new GestureTracker();
    const slot = layout.slotPos[3]!;
    const spot = layout.spots[4]!;
    g.start(1, slot, 0, world());
    const up = g.move(1, { x: slot.x, y: slot.y - 40 }, 20, world());
    expect(up[0]).toMatchObject({ type: 'pickup', creatureId: 'c3', from: 'tray' });
    const end = g.end(1, { x: spot.x, y: spot.y - layout.size / 2 }, 400, world());
    expect(end[0]).toMatchObject({ type: 'drop', creatureId: 'c3', spot: 4 });
  });
  it('releasing a tray creature outside any spot returns it', () => {
    const g = new GestureTracker();
    const slot = layout.slotPos[0]!;
    g.start(1, slot, 0, world());
    g.move(1, { x: slot.x, y: slot.y - 50 }, 10, world());
    expect(g.end(1, { x: 5, y: 5 }, 300, world())[0]).toMatchObject({ type: 'returnToTray' });
  });
  it('horizontal swipe in the tray scrolls on phones', () => {
    const g = new GestureTracker();
    const slot = layout.slotPos[0]!;
    g.start(1, slot, 0, world());
    const ev = g.move(1, { x: slot.x - 120, y: slot.y + 2 }, 30, world());
    expect(ev[0]).toMatchObject({ type: 'scroll' });
    expect((ev[0] as { scrollX: number }).scrollX).toBeCloseTo(120);
  });
  it('tap on a standing creature = tap; hold 400 ms = long press (no tap afterwards)', () => {
    const stage = [null, 'c1', null, null, null, null];
    const p = { x: layout.spots[1]!.x, y: layout.spots[1]!.y - 30 };
    const g = new GestureTracker();
    g.start(1, p, 0, world(stage));
    expect(g.end(1, p, 100, world(stage))).toEqual([{ type: 'tap', creatureId: 'c1' }]);
    g.start(2, p, 1000, world(stage));
    expect(g.tick(1200)).toEqual([]);
    expect(g.tick(1400)).toEqual([{ type: 'longPress', creatureId: 'c1' }]);
    expect(g.end(2, p, 1500, world(stage))).toEqual([]);
  });
  it('dragging a standing creature off the stage or flicking it down removes it', () => {
    const stage = [null, 'c1', null, null, null, null];
    const p = { x: layout.spots[1]!.x, y: layout.spots[1]!.y - 30 };
    const g = new GestureTracker();
    g.start(1, p, 0, world(stage));
    g.move(1, { x: p.x + 40, y: p.y - 40 }, 20, world(stage));
    expect(g.end(1, { x: 3, y: 3 }, 200, world(stage))[0]).toMatchObject({ type: 'remove' });
    g.start(2, p, 1000, world(stage));
    g.move(2, { x: p.x, y: p.y + 30 }, 1010, world(stage));
    g.move(2, { x: p.x + 1, y: p.y + 90 }, 1030, world(stage));
    expect(g.end(2, { x: layout.spots[1]!.x, y: layout.spots[1]!.y - 30 }, 1040, world(stage))[0]).toMatchObject({ type: 'remove' });
  });
  it('two fingers drag two creatures at once', () => {
    const g = new GestureTracker();
    const a = layout.slotPos[0]!, b = layout.slotPos[5]!;
    g.start(1, a, 0, world()); g.start(2, b, 0, world());
    expect(g.move(1, { x: a.x, y: a.y - 50 }, 10, world())[0]).toMatchObject({ creatureId: 'c0' });
    expect(g.move(2, { x: b.x, y: b.y - 50 }, 10, world())[0]).toMatchObject({ creatureId: 'c5' });
    expect(g.end(1, layout.spots[0]!, 100, world())[0]).toMatchObject({ type: 'drop', creatureId: 'c0' });
    expect(g.end(2, layout.spots[5]!, 100, world())[0]).toMatchObject({ type: 'drop', creatureId: 'c5' });
  });
  it('tap on empty stage reports tapEmpty', () => {
    const g = new GestureTracker();
    g.start(1, { x: 20, y: 20 }, 0, world());
    expect(g.end(1, { x: 20, y: 20 }, 50, world())).toEqual([{ type: 'tapEmpty', p: { x: 20, y: 20 } }]);
  });
});

import { popupRects } from '../src/core/layout';
describe('volume popup', () => {
  const stage = [null, 'c1', null, null, null, null];
  const body = { x: layout.spots[1]!.x, y: layout.spots[1]!.y - 30 };
  const w = (popup: World['popup'] = null): World => ({ ...world(stage), popup, volumeOf: () => 0.8 });
  it('hold then drag down lowers the volume; a plain long press changes nothing', () => {
    const g = new GestureTracker();
    g.start(1, body, 0, w());
    expect(g.tick(500, w())).toEqual([{ type: 'longPress', creatureId: 'c1' }]);
    expect(g.move(1, { x: body.x, y: body.y + 3 }, 600, w())).toEqual([]);
    const ev = g.move(1, { x: body.x, y: body.y + layout.size * 0.4 }, 700, w());
    expect(ev[0]).toMatchObject({ type: 'volumeSet', creatureId: 'c1' });
    expect((ev[0] as { value: number }).value).toBeCloseTo(0.8 - 0.4, 1);
    expect(g.end(1, body, 800, w())).toEqual([]); // the popup stays open
  });
  it('slider tap sets the level, solo button solos, outside touch closes', () => {
    const g = new GestureTracker();
    const popup = { spot: 1, creatureId: 'c1' };
    const r = popupRects(layout, 1);
    const top = g.start(1, { x: r.slider.x + 5, y: r.slider.y + 1 }, 0, w(popup));
    expect((top[0] as { value: number }).value).toBeGreaterThan(0.95);
    const low = g.move(1, { x: r.slider.x + 5, y: r.slider.y + r.slider.h - 1 }, 10, w(popup));
    expect((low[0] as { value: number }).value).toBeLessThan(0.05);
    g.end(1, { x: 0, y: 0 }, 20, w(popup));
    g.start(2, { x: r.solo.x + 5, y: r.solo.y + 5 }, 100, w(popup));
    expect(g.end(2, { x: r.solo.x + 5, y: r.solo.y + 5 }, 150, w(popup))).toEqual([{ type: 'popupSolo', creatureId: 'c1' }]);
    expect(g.start(3, { x: 5, y: 5 }, 200, w(popup))[0]).toEqual({ type: 'popupClose' });
  });
  it('popup fits inside the screen for every spot and keeps 52 pt targets', () => {
    for (let i = 0; i < 6; i++) { const r = popupRects(layout, i); expect(r.panel.x).toBeGreaterThanOrEqual(0); expect(r.panel.x + r.panel.w).toBeLessThanOrEqual(layout.W); expect(r.solo.w).toBeGreaterThanOrEqual(52); expect(r.panel.y).toBeGreaterThanOrEqual(0); }
  });
});

describe('swipe to close the volume menu', () => {
  const stage = [null, 'c1', null, null, null, null];
  const popup = { spot: 1, creatureId: 'c1' };
  const wp = (): World => ({ ...world(stage), popup, volumeOf: () => 1 });
  it('a sideways swipe on the panel closes it; vertical drags still set the level; no solo after a swipe', () => {
    const r = popupRects(layout, 1);
    const g = new GestureTracker();
    g.start(1, { x: r.slider.x + 8, y: r.slider.y + 20 }, 0, wp());
    expect(g.move(1, { x: r.slider.x + 12, y: r.slider.y + 60 }, 10, wp())[0]).toMatchObject({ type: 'volumeSet' });
    const sw = g.move(1, { x: r.slider.x + 90, y: r.slider.y + 64 }, 20, wp());
    expect(sw).toEqual([{ type: 'popupClose' }]);
    expect(g.move(1, { x: r.slider.x + 140, y: r.slider.y + 64 }, 30, wp())).toEqual([]); // only once
    g.start(2, { x: r.solo.x + 5, y: r.solo.y + 5 }, 100, wp());
    g.move(2, { x: r.solo.x + 80, y: r.solo.y + 6 }, 110, wp());
    expect(g.end(2, { x: r.solo.x + 5, y: r.solo.y + 5 }, 120, wp())).toEqual([]);
    g.start(3, { x: r.panel.x + 2, y: r.panel.y + 2 }, 200, wp()); // panel padding
    expect(g.move(3, { x: r.panel.x - 60, y: r.panel.y + 4 }, 210, wp())).toEqual([{ type: 'popupClose' }]);
  });
});

describe('hide and show the singer menu', () => {
  it('a downward swipe on the tray hides it (also from a singer); a hidden tray ignores slots; swipe up or tap on the handle shows it', () => {
    const g = new GestureTracker();
    const slot = layout.slotPos[2]!;
    g.start(1, slot, 0, world());
    expect(g.move(1, { x: slot.x + 3, y: slot.y + 40 }, 20, world())).toEqual([{ type: 'trayHide' }]);
    expect(g.end(1, { x: slot.x, y: slot.y + 60 }, 40, world())).toEqual([]);
    const hidden = (): World => ({ ...world(), trayHidden: true });
    g.start(2, slot, 100, hidden()); // where the tray used to be: now empty stage
    expect(g.end(2, slot, 120, hidden())).toEqual([{ type: 'tapEmpty', p: slot }]);
    const handle = { x: layout.W / 2, y: layout.H - 10 };
    g.start(3, handle, 200, hidden());
    expect(g.move(3, { x: handle.x, y: handle.y - 30 }, 210, hidden())).toEqual([{ type: 'trayShow' }]);
    expect(g.end(3, handle, 220, hidden())).toEqual([]);
    g.start(4, handle, 300, hidden());
    expect(g.end(4, handle, 310, hidden())).toEqual([{ type: 'trayShow' }]);
  });
  it('an upward drag from a singer still picks it up', () => {
    const g = new GestureTracker();
    const slot = layout.slotPos[1]!;
    g.start(1, slot, 0, world());
    expect(g.move(1, { x: slot.x, y: slot.y - 40 }, 10, world())[0]).toMatchObject({ type: 'pickup' });
  });
});

describe('layout with a top overlay', () => {
  it('shrinks singers so the tallest one stays below the toolbar, never under 56 pt', () => {
    const plain = computeLayout(844, 390);
    const withBar = computeLayout(844, 390, undefined, 0, 66);
    expect(withBar.size).toBeLessThan(plain.size);
    expect(withBar.size).toBeGreaterThanOrEqual(56);
    const backRowY = Math.min(...withBar.spots.map((s) => s.y));
    expect(backRowY - withBar.size * 1.5).toBeGreaterThanOrEqual(66 - 1);
  });
});

import { emptyStage, nextFreeSpot, reduceStage } from '../src/core/stageState';
describe('tap a singer in the menu', () => {
  it('a tap on a free singer adds it; a tap on one already on stage does nothing; the middle fills first', () => {
    const g = new GestureTracker();
    const slot = layout.slotPos[4]!;
    g.start(1, slot, 0, world());
    expect(g.end(1, slot, 80, world())).toEqual([{ type: 'trayTap', creatureId: 'c4' }]);
    const onStage = [null, 'c4', null, null, null, null];
    g.start(2, slot, 200, world(onStage));
    expect(g.end(2, slot, 260, world(onStage))).toEqual([]);
    let s = emptyStage();
    const order: number[] = [];
    for (let i = 0; i < 6; i++) { const sp = nextFreeSpot(s); order.push(sp); s = reduceStage(s, { kind: 'drop', creatureId: `x${i}`, spot: sp }); }
    expect(order).toEqual([2, 3, 1, 4, 0, 5]);
    expect(nextFreeSpot(s)).toBe(-1);
  });
});

describe('dragging a singer from the menu to a far spot', () => {
  it('a shallow diagonal start still becomes a drag once the finger rises; a flat swipe scrolls', () => {
    const g = new GestureTracker();
    const slot = layout.slotPos[1]!;
    g.start(1, slot, 0, world());
    const a = g.move(1, { x: slot.x + 30, y: slot.y - 4 }, 10, world()); // flat so far: scrolling
    expect(a[0]).toMatchObject({ type: 'scroll' });
    const b = g.move(1, { x: slot.x + 70, y: slot.y - 40 }, 30, world()); // rises: pick up
    expect(b.map((e) => e.type)).toEqual(['scroll', 'pickup']);
    expect(g.move(1, { x: slot.x + 200, y: slot.y - 100 }, 50, world())[0]).toMatchObject({ type: 'drag' });
    const spot = layout.spots[2]!;
    expect(g.end(1, { x: spot.x, y: spot.y - layout.size / 2 }, 80, world())[0]).toMatchObject({ type: 'drop', creatureId: 'c1', spot: 2 });
  });
  it('a diagonal at about 20 degrees dragged from a singer on a tablet picks up immediately (nothing to scroll)', () => {
    const big = computeLayout(1600, 900);
    const w2: World = { layout: big, scrollX: 0, trayIds: ids, onStage: [null, null, null, null, null, null] };
    const g = new GestureTracker();
    const slot = big.slotPos[1]!;
    g.start(1, slot, 0, w2);
    expect(g.move(1, { x: slot.x + 30, y: slot.y - 12 }, 10, w2)[0]).toMatchObject({ type: 'pickup' });
  });
});
