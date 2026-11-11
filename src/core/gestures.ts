import { TUNING } from './tuning';
import { inRect, popupRects, slotAt, spotAt, standingAt, type Layout, type Pt } from './layout';

export type GestureEvent =
  | { type: 'pickup'; touch: number; creatureId: string; from: 'tray' | 'stage'; p: Pt }
  | { type: 'drag'; touch: number; creatureId: string; p: Pt }
  | { type: 'drop'; touch: number; creatureId: string; spot: number; p: Pt } // lands on a spot
  | { type: 'returnToTray'; touch: number; creatureId: string; p: Pt } // released outside any spot (from tray)
  | { type: 'remove'; touch: number; creatureId: string; p: Pt } // dragged off the stage or flicked down
  | { type: 'tap'; creatureId: string }
  | { type: 'longPress'; creatureId: string } // opens the volume popup for this creature
  | { type: 'volumeSet'; creatureId: string; value: number } // slider or hold-and-drag
  | { type: 'popupSolo'; creatureId: string }
  | { type: 'popupClose' }
  | { type: 'trayTap'; creatureId: string } // tap a free singer in the menu: it hops onto the stage
  | { type: 'trayHide' } // swipe down on the singer menu
  | { type: 'trayShow' } // swipe up or tap the handle
  | { type: 'tapEmpty'; p: Pt }
  | { type: 'scroll'; scrollX: number };

/** What the gesture layer needs to know about the world. Supplied fresh on every call. */
export interface World {
  layout: Layout;
  scrollX: number;
  trayIds: readonly string[]; // creature id per tray slot
  onStage: readonly (string | null)[]; // creature id per spot
  popup?: { spot: number; creatureId: string } | null; // volume popup currently open
  volumeOf?: (id: string) => number;
  trayHidden?: boolean; // the singer menu is slid away; only its handle strip at the bottom edge reacts
}

type Touch =
  | { kind: 'pendingStage'; id: string; start: Pt; startT: number; fired: boolean }
  | { kind: 'pendingTray'; id: string | null; slot: number; start: Pt; startT: number; scrollStart: number }
  | { kind: 'pendingEmpty'; start: Pt }
  | { kind: 'drag'; id: string; from: 'tray' | 'stage'; last: Pt; lastT: number; vy: number }
  | { kind: 'scroll'; start: Pt; scrollStart: number; id: string | null } // id: the free singer under the first touch, may still be picked up
  | { kind: 'hold'; id: string; startY: number; startVol: number } // long press fired: dragging changes the volume
  | { kind: 'slider'; id: string; start: Pt }
  | { kind: 'popupSolo'; id: string; start: Pt }
  | { kind: 'swallow'; start: Pt; closed?: boolean }
  | { kind: 'handle'; start: Pt; done?: boolean };

export const TRAY_HANDLE_H = 40; // touch strip at the bottom edge while the menu is hidden
const SLOP = 10; // px of movement before a touch stops being a tap

export class GestureTracker {
  private touches = new Map<number, Touch>();
  scrollX = 0;

  /** Finger down. */
  start(touch: number, p: Pt, t: number, w: World): GestureEvent[] {
    const lead: GestureEvent[] = [];
    if (w.popup) {
      const r = popupRects(w.layout, w.popup.spot);
      if (inRect(r.panel, p)) {
        if (inRect(r.solo, p)) this.touches.set(touch, { kind: 'popupSolo', id: w.popup.creatureId, start: p });
        else if (inRect(r.slider, p)) {
          this.touches.set(touch, { kind: 'slider', id: w.popup.creatureId, start: p });
          return [{ type: 'volumeSet', creatureId: w.popup.creatureId, value: this.sliderValue(w, p) }];
        } else this.touches.set(touch, { kind: 'swallow', start: p });
        return [];
      }
      lead.push({ type: 'popupClose' }); // a touch anywhere else closes it and then behaves normally
    }
    this.scrollX = Math.min(w.layout.scrollMax, Math.max(0, w.scrollX));
    if (w.trayHidden && p.y >= w.layout.H - TRAY_HANDLE_H) {
      this.touches.set(touch, { kind: 'handle', start: p });
      return lead;
    }
    if (!w.trayHidden && p.y >= w.layout.tray.y) {
      const slot = slotAt(w.layout, p, this.scrollX);
      const id = slot >= 0 ? w.trayIds[slot]! : null;
      const free = id !== null && !w.onStage.includes(id);
      this.touches.set(touch, { kind: 'pendingTray', id: free ? id : null, slot, start: p, startT: t, scrollStart: this.scrollX });
      return lead;
    }
    const spot = standingAt(w.layout, p, w.onStage.map((x) => x !== null));
    if (spot >= 0) {
      this.touches.set(touch, { kind: 'pendingStage', id: w.onStage[spot]!, start: p, startT: t, fired: false });
      return lead;
    }
    this.touches.set(touch, { kind: 'pendingEmpty', start: p });
    return lead;
  }

  move(touch: number, p: Pt, t: number, w: World): GestureEvent[] {
    const s = this.touches.get(touch);
    if (!s) return [];
    const dist = (a: Pt) => Math.hypot(p.x - a.x, p.y - a.y);
    switch (s.kind) {
      case 'pendingStage':
        if (dist(s.start) > SLOP) {
          this.touches.set(touch, { kind: 'drag', id: s.id, from: 'stage', last: p, lastT: t, vy: 0 });
          return [{ type: 'pickup', touch, creatureId: s.id, from: 'stage', p }];
        }
        return [];
      case 'handle': {
        if (s.done) return [];
        if (s.start.y - p.y > SLOP * 1.5) { this.touches.set(touch, { ...s, done: true }); return [{ type: 'trayShow' }]; }
        return [];
      }
      case 'pendingTray': {
        if (dist(s.start) <= SLOP) return [];
        const dx = p.x - s.start.x, dy = p.y - s.start.y;
        if (dy > 0 && dy > Math.abs(dx) * 1.2) { this.touches.delete(touch); return [{ type: 'trayHide' }]; } // a downward swipe tucks the menu away
        const horizontal = Math.abs(dx) > Math.abs(dy) * 2; // a clearly flat swipe scrolls; anything steeper picks the singer up
        if (s.id && !(horizontal && w.layout.scrollMax > 0 && dy > -SLOP * 0.8)) {
          this.touches.set(touch, { kind: 'drag', id: s.id, from: 'tray', last: p, lastT: t, vy: 0 });
          return [{ type: 'pickup', touch, creatureId: s.id, from: 'tray', p }];
        }
        if (w.layout.scrollMax > 0) {
          this.touches.set(touch, { kind: 'scroll', start: s.start, scrollStart: s.scrollStart, id: s.id });
          return this.scrollTo(s.scrollStart - dx, w);
        }
        return [];
      }
      case 'popupSolo':
      case 'swallow': {
        if (s.kind === 'swallow' && s.closed) return [];
        if (this.isCloseSwipe(s.start, p)) { this.touches.set(touch, { kind: 'swallow', start: s.start, closed: true }); return [{ type: 'popupClose' }]; }
        return [];
      }
      case 'slider': {
        // a sideways swipe across the menu dismisses it; mostly vertical movement is the slider
        if (this.isCloseSwipe(s.start, p)) { this.touches.set(touch, { kind: 'swallow', start: s.start, closed: true }); return [{ type: 'popupClose' }]; }
        return [{ type: 'volumeSet', creatureId: s.id, value: this.sliderValue(w, p) }];
      }
      case 'hold': {
        if (Math.abs(p.y - s.startY) < SLOP) return [];
        return [{ type: 'volumeSet', creatureId: s.id, value: Math.min(1, Math.max(0, s.startVol - (p.y - s.startY) / w.layout.size)) }];
      }
      case 'scroll': {
        // a flat swipe that turns upward is a drag after all (dragging to a far spot starts shallow)
        const up = s.start.y - p.y;
        if (s.id && up > SLOP * 2.2 && up > Math.abs(p.x - s.start.x) * 0.3) {
          this.touches.set(touch, { kind: 'drag', id: s.id, from: 'tray', last: p, lastT: t, vy: 0 });
          return [{ type: 'scroll', scrollX: s.scrollStart }, { type: 'pickup', touch, creatureId: s.id, from: 'tray', p }];
        }
        return this.scrollTo(s.scrollStart - (p.x - s.start.x), w);
      }
      case 'drag': {
        const dt = Math.max(1, t - s.lastT);
        const vy = ((p.y - s.last.y) / dt) * 1000;
        this.touches.set(touch, { ...s, last: p, lastT: t, vy: 0.5 * s.vy + 0.5 * vy });
        return [{ type: 'drag', touch, creatureId: s.id, p }];
      }
      default:
        return [];
    }
  }

  end(touch: number, p: Pt, _t: number, w: World): GestureEvent[] {
    const s = this.touches.get(touch);
    this.touches.delete(touch);
    if (!s) return [];
    switch (s.kind) {
      case 'pendingStage': return s.fired ? [] : [{ type: 'tap', creatureId: s.id }];
      case 'pendingEmpty': return [{ type: 'tapEmpty', p }];
      case 'handle': return s.done ? [] : [{ type: 'trayShow' }];
      case 'pendingTray': return s.id ? [{ type: 'trayTap', creatureId: s.id }] : [];
      case 'popupSolo': {
        if (!w.popup) return [];
        return inRect(popupRects(w.layout, w.popup.spot).solo, p) ? [{ type: 'popupSolo', creatureId: s.id }] : [];
      }
      case 'drag': {
        const spot = p.y < w.layout.tray.y ? spotAt(w.layout, p) : -1;
        if (s.from === 'stage') {
          const flick = s.vy >= TUNING.flickDownVelocity;
          if (flick || spot < 0) return [{ type: 'remove', touch, creatureId: s.id, p }];
          return [{ type: 'drop', touch, creatureId: s.id, spot, p }];
        }
        if (spot >= 0) return [{ type: 'drop', touch, creatureId: s.id, spot, p }];
        return [{ type: 'returnToTray', touch, creatureId: s.id, p }];
      }
      default: return [];
    }
  }

  cancel(touch: number, w: World): GestureEvent[] {
    const s = this.touches.get(touch);
    this.touches.delete(touch);
    if (s?.kind === 'drag' && s.from === 'tray') return [{ type: 'returnToTray', touch, creatureId: s.id, p: s.last }];
    if (s?.kind === 'drag' && s.from === 'stage') return [{ type: 'drop', touch, creatureId: s.id, spot: Math.max(0, w.onStage.indexOf(s.id)), p: s.last }];
    return [];
  }

  /** Call regularly (or at deadline) to detect long presses. */
  tick(t: number, w?: World): GestureEvent[] {
    const out: GestureEvent[] = [];
    for (const [id, s] of this.touches) {
      if (s.kind === 'pendingStage' && !s.fired && t - s.startT >= TUNING.longPressMs) {
        this.touches.set(id, { kind: 'hold', id: s.id, startY: s.start.y, startVol: w?.volumeOf?.(s.id) ?? 1 });
        out.push({ type: 'longPress', creatureId: s.id });
      }
    }
    return out;
  }
  /** Fingers currently down. */
  get activeCount(): number { return this.touches.size; }
  get hasPendingLongPress(): boolean {
    for (const s of this.touches.values()) if (s.kind === 'pendingStage' && !s.fired) return true;
    return false;
  }

  /** Horizontal swipe (at least 40 px and clearly more sideways than vertical). */
  private isCloseSwipe(a: Pt, b: Pt): boolean {
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    return dx >= 40 && dx > dy * 1.5;
  }

  private sliderValue(w: World, p: Pt): number {
    const r = popupRects(w.layout, w.popup!.spot).slider;
    return Math.min(1, Math.max(0, 1 - (p.y - r.y) / r.h));
  }

  private scrollTo(x: number, w: World): GestureEvent[] {
    this.scrollX = Math.min(w.layout.scrollMax, Math.max(0, x));
    return [{ type: 'scroll', scrollX: this.scrollX }];
  }
}
