import { describe, expect, it } from 'vitest';
import { STAGES } from '../src/content';
import { computeLayout } from '../src/core/layout';
import { GestureTracker, type World } from '../src/core/gestures';
import { hasLesson, LESSON_STEPS, lessonCanPick, lessonCue, lessonDirection, lessonLit, lessonScrollTarget, lessonStep, lessonTotalCoins } from '../src/core/lesson';

const stage = STAGES[0]!;
const first = (layer: string) => stage.creatures.find((c) => c.layer === layer)!.id;
const spots = (...ids: string[]): (string | null)[] => { const a: (string | null)[] = Array(6).fill(null); ids.forEach((id, i) => { a[i + 1] = id; }); return a; };
const phone = () => computeLayout(844, 390, undefined, 8, 60); // a phone held sideways: the menu holds about 11 of the 24 singers

describe('lesson: the step is how many groups, in order, already have a singer on stage', () => {
  it('starts at the drums and ends after the voice', () => {
    expect(lessonStep(stage, spots())).toBe(0);
    expect(lessonStep(stage, spots(first('drums')))).toBe(1);
    expect(lessonStep(stage, spots(first('drums'), first('bass')))).toBe(2);
    expect(lessonStep(stage, spots(first('drums'), first('bass'), first('melody')))).toBe(3);
    expect(lessonStep(stage, spots(first('drums'), first('bass'), first('melody'), first('voice')))).toBe(LESSON_STEPS);
  });
  it('a later group does not count before the earlier ones are in', () => {
    expect(lessonStep(stage, spots(first('bass')))).toBe(0);
    expect(lessonStep(stage, spots(first('drums'), first('melody')))).toBe(1);
  });
  it('lights one group at a time, none when finished', () => {
    expect([0, 1, 2, 3].map(lessonLit)).toEqual(['drums', 'bass', 'melody', 'voice']);
    expect(lessonLit(4)).toBeNull();
  });
  it('only singers of the lit group can be picked', () => {
    expect(lessonCanPick(stage, 0, first('drums'))).toBe(true);
    expect(lessonCanPick(stage, 0, first('bass'))).toBe(false);
    expect(lessonCanPick(stage, 2, first('melody'))).toBe(true);
    expect(lessonCanPick(stage, 4, first('voice'))).toBe(false);
  });
  it('pays a coin per singer and a bonus for finishing', () => {
    expect(lessonTotalCoins()).toBe(10);
  });
});

describe('lesson: which worlds', () => {
  it('only the first world has a lesson for now', () => {
    expect(hasLesson('pond')).toBe(true);
    for (const id of ['fair', 'clouds', 'neon', 'frost']) expect(hasLesson(id), id).toBe(false);
  });
});

describe('lesson: the hand and the menu', () => {
  const l = phone();
  it('drags the first group at once (it is on screen)', () => {
    const cue = lessonCue(stage, l, 0, spots(), 0)!;
    expect(cue.kind).toBe('drag');
    expect(stage.creatures[cue.slot]!.layer).toBe('drums');
    expect(spots()[cue.spot]).toBeNull();
  });
  it('sends the menu towards a group that is out of sight, then drags once it is on screen', () => {
    const s3 = spots(first('drums'), first('bass'));
    expect(lessonDirection(stage, l, 0, 'melody')).toBe(1);
    expect(lessonCue(stage, l, 0, s3, 2)).toMatchObject({ kind: 'swipe', dir: 1 });
    const target = lessonScrollTarget(stage, l, 0, 'melody');
    expect(target).not.toBeNull();
    expect(target!).toBeGreaterThan(0);
    expect(target!).toBeLessThanOrEqual(l.scrollMax);
    const cue = lessonCue(stage, l, target!, s3, 2)!;
    expect(cue.kind).toBe('drag');
    expect(stage.creatures[cue.slot]!.layer).toBe('melody');
  });
  it('points back to the left when the menu was slid too far', () => {
    expect(lessonDirection(stage, l, l.scrollMax, 'drums')).toBe(-1);
    expect(lessonCue(stage, l, l.scrollMax, spots(), 0)).toMatchObject({ kind: 'swipe', dir: -1 });
    expect(lessonScrollTarget(stage, l, l.scrollMax, 'drums')).toBe(0);
  });
  it('no hand once the lesson is finished', () => {
    expect(lessonCue(stage, l, 0, spots(), 4)).toBeNull();
  });
});

describe('lesson: the gesture layer', () => {
  const l = phone();
  const world = (step: number, onStage: (string | null)[] = spots(), scrollX = 0): World => ({
    layout: l, scrollX, trayIds: stage.creatures.map((c) => c.id), onStage,
    canPick: (id) => lessonCanPick(stage, step, id), locked: true,
  });
  const slotPoint = (i: number, scrollX = 0) => ({ x: l.slotPos[i]!.x - scrollX, y: l.slotPos[i]!.y - l.size * 0.2 });

  it('picks up a singer of the lit group', () => {
    const t = new GestureTracker();
    const p = slotPoint(0);
    t.start(1, p, 0, world(0));
    const evs = t.move(1, { x: p.x, y: p.y - 60 }, 50, world(0));
    expect(evs[0]).toMatchObject({ type: 'pickup', creatureId: stage.creatures[0]!.id });
  });
  it('does not pick up a dark group: a drag on it only slides the menu', () => {
    const t = new GestureTracker();
    const bass = stage.creatures.findIndex((c) => c.layer === 'bass');
    const p = slotPoint(bass);
    t.start(1, p, 0, world(0));
    const evs = t.move(1, { x: p.x - 80, y: p.y }, 50, world(0));
    expect(evs.some((e) => e.type === 'pickup')).toBe(false);
    expect(evs[0]).toMatchObject({ type: 'scroll' });
  });
  it('a tap on a dark singer does nothing', () => {
    const t = new GestureTracker();
    const bass = stage.creatures.findIndex((c) => c.layer === 'bass');
    const p = slotPoint(bass);
    t.start(1, p, 0, world(0));
    expect(t.end(1, p, 50, world(0))).toEqual([]);
  });
  it('cannot tuck the menu away or touch a singer on stage', () => {
    const t = new GestureTracker();
    const p = slotPoint(20);
    t.start(1, p, 0, world(0));
    expect(t.move(1, { x: p.x, y: p.y + 70 }, 50, world(0)).some((e) => e.type === 'trayHide')).toBe(false);
    const t2 = new GestureTracker();
    const on = spots(first('drums'));
    const sp = { x: l.spots[1]!.x, y: l.spots[1]!.y - l.size * 0.4 };
    t2.start(2, sp, 0, world(1, on));
    const evs = [...t2.move(2, { x: sp.x + 60, y: sp.y }, 50, world(1, on)), ...t2.end(2, { x: sp.x + 60, y: sp.y }, 80, world(1, on))];
    expect(evs.some((e) => e.type === 'pickup' || e.type === 'remove' || e.type === 'tap' || e.type === 'longPress')).toBe(false);
  });
});
