import { describe, expect, it } from 'vitest';
import { STAGES } from '../src/content';
import { computeLayout } from '../src/core/layout';
import { GestureTracker, type World } from '../src/core/gestures';
import { level4Band, level4Cue, level4Step, LEVEL4_SPOTS, levelMapStates, worldStart, hasLesson, LEVEL3_SPOTS, level3Band, level3Cue, level3Step, levelBand, LEVEL2_SPOTS, level2Band, level2Cue, level2Step, lessonPickable, lessonSteps, levelKey, nextLevel, LESSON_STEPS, lessonCanPick, lessonCue, lessonDirection, lessonLit, lessonScrollTarget, lessonStep, lessonTotalCoins } from '../src/core/lesson';

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

describe('level 2: my band', () => {
  const l = phone();
  const band = level2Band(stage);
  const onStage = (...ids: string[]): (string | null)[] => { const a: (string | null)[] = Array(6).fill(null); ids.forEach((id, i) => { a[LEVEL2_SPOTS[i] ?? i + 1] = id; }); return a; };
  it('is the first singer of the drums, bass and melody groups', () => {
    expect(band.map((id) => stage.creatures.find((c) => c.id === id)!.layer)).toEqual(['drums', 'bass', 'melody']);
  });
  it('goes silence, wake, choose, done', () => {
    const three = onStage(...band);
    expect(level2Step(three, {}, false)).toBe(0);
    expect(level2Step(three, { [band[0]!]: true }, true)).toBe(1);
    expect(level2Step(three, {}, true)).toBe(2); // woken again
    expect(level2Step(onStage(...band, first('voice')), {}, true)).toBe(3);
    expect(level2Step(onStage(...band, first('voice')), {}, false)).toBe(0); // a fourth singer alone does not skip the taps
  });
  it('shows a tap on the singer to silence, then on the silenced one, then a drag', () => {
    const three = onStage(...band);
    expect(level2Cue(stage, l, 0, three, {}, 0)).toMatchObject({ kind: 'tap', spot: LEVEL2_SPOTS[0] });
    expect(level2Cue(stage, l, 0, three, { [band[1]!]: true }, 1)).toMatchObject({ kind: 'tap', spot: LEVEL2_SPOTS[1] });
    const drag = level2Cue(stage, l, 0, three, {}, 2)!;
    expect(drag.kind).toBe('drag');
    expect(three.includes(stage.creatures[drag.slot]!.id)).toBe(false);
    expect(three[drag.spot]).toBeNull();
    expect(level2Cue(stage, l, 0, onStage(...band, first('voice')), {}, 3)).toBeNull();
  });
  it('the menu is dark until the third step, then anything can be picked', () => {
    for (const step of [0, 1]) expect(lessonPickable(2, stage, step, first('voice'))).toBe(false);
    expect(lessonPickable(2, stage, 2, first('voice'))).toBe(true);
    expect(lessonPickable(2, stage, 2, first('drums'))).toBe(true);
  });
  it('knows which level comes next and what it pays', () => {
    expect(levelKey('pond', 1)).toBe('pond');
    expect(levelKey('pond', 2)).toBe('pond:2');
    expect(nextLevel('pond', [])).toBe(1);
    expect(nextLevel('pond', ['pond'])).toBe(2);
    expect(nextLevel('pond', ['pond', 'pond:2'])).toBe(3);
    expect(nextLevel('pond', ['pond', 'pond:2', 'pond:3'])).toBe(4);
    expect(nextLevel('pond', ['pond', 'pond:2', 'pond:3', 'pond:4'])).toBeNull();
    expect(nextLevel('fair', [])).toBeNull();
    expect([lessonSteps(1), lessonSteps(2), lessonSteps(3), lessonSteps(4)]).toEqual([4, 3, 3, 3]);
    expect(lessonTotalCoins(2)).toBe(8);
  });
  it('a singer on stage can only be tapped: no dragging it off, no long press', () => {
    const w: World = { layout: l, scrollX: 0, trayIds: stage.creatures.map((c) => c.id), onStage: onStage(...band), canPick: () => false, tapOnly: true, noHide: true };
    const t = new GestureTracker();
    const sp = { x: l.spots[LEVEL2_SPOTS[0]!]!.x, y: l.spots[LEVEL2_SPOTS[0]!]!.y - l.size * 0.4 };
    t.start(1, sp, 0, w);
    expect(t.move(1, { x: sp.x + 60, y: sp.y + 40 }, 40, w)).toEqual([]);
    expect(t.end(1, { x: sp.x + 60, y: sp.y + 40 }, 80, w)).toEqual([{ type: 'tap', creatureId: band[0] }]);
    const t2 = new GestureTracker();
    t2.start(2, sp, 0, w);
    expect(t2.tick(5000, w)).toEqual([]);
  });
  it('the menu cannot be tucked away and a dark singer only slides it', () => {
    const w: World = { layout: l, scrollX: 0, trayIds: stage.creatures.map((c) => c.id), onStage: onStage(...band), canPick: () => false, tapOnly: true, noHide: true };
    const t = new GestureTracker();
    const p = { x: l.slotPos[3]!.x, y: l.slotPos[3]!.y - l.size * 0.2 };
    t.start(1, p, 0, w);
    const evs = t.move(1, { x: p.x, y: p.y + 70 }, 50, w);
    expect(evs.some((e) => e.type === 'trayHide' || e.type === 'pickup')).toBe(false);
  });
});

describe('level 3: volume', () => {
  const l = phone();
  const band = level3Band(stage);
  const four = (): (string | null)[] => { const a: (string | null)[] = Array(6).fill(null); band.forEach((id, i) => { a[LEVEL3_SPOTS[i]!] = id; }); return a; };
  it('is one singer of every group, on spots 1 to 4', () => {
    expect(band.map((id) => stage.creatures.find((c) => c.id === id)!.layer)).toEqual(['drums', 'bass', 'melody', 'voice']);
    expect(levelBand(3, stage)).toEqual({ ids: band, spots: LEVEL3_SPOTS });
    expect(levelBand(2, stage)!.ids).toHaveLength(3);
    expect(levelBand(1, stage)).toBeNull();
  });
  it('goes lower, raise, star, done', () => {
    const spots = four();
    expect(level3Step(spots, {}, null, false)).toBe(0);
    expect(level3Step(spots, { [band[0]!]: 0.3 }, null, true)).toBe(1); // lowered, not raised yet
    expect(level3Step(spots, { [band[0]!]: 0.8 }, null, true)).toBe(2); // raised again
    expect(level3Step(spots, {}, band[0]!, true)).toBe(3); // the star is on
    expect(level3Step(spots, { [band[0]!]: 0.3 }, band[0]!, false)).toBe(0); // never quiet enough: no skipping
  });
  it('holds first, slides the slider down then up once it is open, then taps the star', () => {
    const spots = four();
    expect(level3Cue(stage, spots, {}, null, 0)).toMatchObject({ kind: 'hold', spot: LEVEL3_SPOTS[0], dir: 1 });
    expect(level3Cue(stage, spots, {}, { spot: 1 }, 0)).toMatchObject({ kind: 'slide', spot: 1, dir: 1 });
    expect(level3Cue(stage, spots, { [band[2]!]: 0.2 }, null, 1)).toMatchObject({ kind: 'hold', spot: LEVEL3_SPOTS[2], dir: -1 });
    expect(level3Cue(stage, spots, { [band[2]!]: 0.2 }, { spot: 3 }, 1)).toMatchObject({ kind: 'slide', dir: -1 });
    expect(level3Cue(stage, spots, {}, { spot: 1 }, 2)).toMatchObject({ kind: 'solo', spot: 1 });
    expect(level3Cue(stage, spots, {}, null, 3)).toBeNull();
  });
  it('pays like the others and nothing can be picked from the menu', () => {
    expect(lessonSteps(3)).toBe(3);
    expect(lessonTotalCoins(3)).toBe(9);
    for (const step of [0, 1, 2]) expect(lessonPickable(3, stage, step, first('voice'))).toBe(false);
  });
  it('a singer on stage can only be held: a tap or a drag does nothing, a long press opens the slider', () => {
    const w: World = { layout: l, scrollX: 0, trayIds: stage.creatures.map((c) => c.id), onStage: four(), canPick: () => false, holdOnly: true, noHide: true };
    const sp = { x: l.spots[LEVEL3_SPOTS[0]!]!.x, y: l.spots[LEVEL3_SPOTS[0]!]!.y - l.size * 0.4 };
    const t = new GestureTracker();
    t.start(1, sp, 0, w);
    expect(t.end(1, sp, 60, w)).toEqual([]);
    const t2 = new GestureTracker();
    t2.start(2, sp, 0, w);
    expect(t2.move(2, { x: sp.x + 60, y: sp.y + 40 }, 40, w)).toEqual([]);
    const t3 = new GestureTracker();
    t3.start(3, sp, 0, w);
    expect(t3.tick(5000, w)).toEqual([{ type: 'longPress', creatureId: band[0] }]);
  });
});

describe('level map', () => {
  it('shows finished circles, the one that waits and the ones not open yet', () => {
    expect(levelMapStates('pond', []).map((x) => x.state)).toEqual(['current', 'locked', 'locked', 'locked']);
    expect(levelMapStates('pond', ['pond']).map((x) => x.state)).toEqual(['done', 'current', 'locked', 'locked']);
    expect(levelMapStates('pond', ['pond', 'pond:2', 'pond:3', 'pond:4']).map((x) => x.state)).toEqual(['done', 'done', 'done', 'done']);
    expect(levelMapStates('pond', ['pond:2']).map((x) => x.state)).toEqual(['current', 'done', 'current', 'locked']); // an older save: the order is only a guide
  });
  it('a new player goes straight into level 1, everyone else sees the map, other worlds have none', () => {
    expect(worldStart('pond', [])).toBe('play');
    expect(worldStart('pond', ['pond'])).toBe('map');
    expect(worldStart('pond', ['pond:3'])).toBe('map');
    expect(worldStart('fair', [])).toBeNull();
    expect(worldStart('fair', ['pond'])).toBeNull();
  });
});

describe('level 4: swap', () => {
  const l = phone();
  const band = level4Band(stage);
  const full = (): (string | null)[] => { const a: (string | null)[] = Array(6).fill(null); band.forEach((id, i) => { a[LEVEL4_SPOTS[i]!] = id; }); return a; };
  it('is a full stage of six different singers, all four groups among them', () => {
    expect(new Set(band).size).toBe(6);
    expect(new Set(band.map((id) => stage.creatures.find((c) => c.id === id)!.layer))).toEqual(new Set(['drums', 'bass', 'melody', 'voice']));
    expect(levelBand(4, stage)).toEqual({ ids: band, spots: LEVEL4_SPOTS });
  });
  it('counts swaps up to three', () => {
    expect([0, 1, 2, 3, 4].map(level4Step)).toEqual([0, 1, 2, 3, 3]);
    expect(lessonTotalCoins(4)).toBe(9);
  });
  it('carries a free singer onto a different singer on stage each time, then stops', () => {
    const spots = full();
    const a = level4Cue(stage, l, 0, spots, 0)!, b = level4Cue(stage, l, 0, spots, 1)!;
    expect(a.kind).toBe('drag');
    expect(spots[a.spot]).not.toBeNull();
    expect(spots.includes(stage.creatures[a.slot]!.id)).toBe(false);
    expect(b.spot).not.toBe(a.spot);
    expect(level4Cue(stage, l, 0, spots, 3)).toBeNull();
  });
  it('everything can be picked from the menu', () => {
    for (const step of [0, 1, 2]) expect(lessonPickable(4, stage, step, first('voice'))).toBe(true);
  });
});
