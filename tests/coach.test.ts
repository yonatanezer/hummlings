import { describe, expect, it } from 'vitest';
import { COACH_IDLE_MS, coachKind, pickSlot, pickSpot, pickTapSpot } from '../src/core/coach';

const base = { onStage: 0, firstDropDone: false, moreDone: false, tapDone: false, idleMs: 0 };

describe('coach: what the hand shows', () => {
  it('shows the first drag at once on a new player and only after a pause later', () => {
    expect(coachKind(base)).toBe('drag');
    expect(coachKind({ ...base, firstDropDone: true })).toBeNull();
    expect(coachKind({ ...base, firstDropDone: true, idleMs: COACH_IDLE_MS.again })).toBe('drag');
  });
  it('asks for more singers after a short pause until three have been on stage', () => {
    const one = { ...base, onStage: 1, firstDropDone: true };
    expect(coachKind(one)).toBeNull();
    expect(coachKind({ ...one, idleMs: COACH_IDLE_MS.more })).toBe('drag');
    expect(coachKind({ ...one, onStage: 2, idleMs: COACH_IDLE_MS.more })).toBe('drag');
    expect(coachKind({ ...one, onStage: 3, idleMs: 99999 })).toBeNull();
  });
  it('shows a tap once three were reached, never before, and stops once a tap was made', () => {
    const three = { ...base, onStage: 3, firstDropDone: true, moreDone: true };
    expect(coachKind(three)).toBeNull();
    expect(coachKind({ ...three, idleMs: COACH_IDLE_MS.tap })).toBe('tap');
    expect(coachKind({ ...three, tapDone: true, idleMs: 99999 })).toBeNull();
    expect(coachKind({ ...three, onStage: 1, idleMs: 99999 })).toBeNull();
  });
});

describe('coach: where the hand goes', () => {
  it('moves the first tray singer that is not on stage and is on screen', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const xs = [-50, 100, 400, 2000];
    expect(pickSlot(ids, new Set(), xs, 800)).toBe(1); // 0 is scrolled out of view
    expect(pickSlot(ids, new Set(['b']), xs, 800)).toBe(2);
    expect(pickSlot(ids, new Set(['a', 'b', 'c', 'd']), xs, 800)).toBe(0); // nothing free: a harmless default
  });
  it('uses the middle of the stage first and skips occupied spots', () => {
    expect(pickSpot([null, null, null, null, null, null])).toBe(2);
    expect(pickSpot([null, null, 'x', null, null, null])).toBe(3);
    expect(pickSpot(['a', 'b', 'c', 'd', 'e', 'f'])).toBe(0);
  });
  it('taps a singer that is awake', () => {
    expect(pickTapSpot([null, null, 'x', 'y', null, null], {})).toBe(2);
    expect(pickTapSpot([null, null, 'x', 'y', null, null], { x: true })).toBe(3);
  });
});
