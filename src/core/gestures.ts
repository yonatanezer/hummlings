import { TUNING } from './tuning';
import { slotAt, spotAt, standingAt, type Layout, type Pt } from './layout';

export type GestureEvent =
  | { type: 'pickup'; touch: number; creatureId: string; from: 'tray' | 'stage'; p: Pt }
  | { type: 'drag'; touch: number; creatureId: string; p: Pt }
  | { type: 'drop'; touch: number; creatureId: string; spot: number; p: Pt } // lands on a spot
  | { type: 'returnToTray'; touch: number; creatureId: string; p: Pt } // released outside any spot (from tray)
  | { type: 'remove'; touch: number; creatureId: string; p: Pt } // dragged off the stage or flicked down
  | { type: 'tap'; creatureId: string }
  | { type: 'longPress'; creatureId: string }
  | { type: 'tapEmpty' }
  | { type: 'scroll'; scrollX: number };

/** What the gesture layer needs to know about the world. Supplied fresh on every call. */
export interface World {
  layout: Layout;
  scrollX: number;
  trayIds: readonly string[]; // creature id per tray slot
  onStage: readonly (string | null)[]; // creature id per spot
}

type Touch =
  | { kind: 'pendingStage'; id: string; start: Pt; startT: number; fired: boolean }
  | { kind: 'pendingTray'; id: string | null; slot: number; start: Pt; startT: number; scrollStart: number }
  | { kind: 'pendingEmpty'; start: Pt }
  | { kind: 'drag'; id: string; from: 'tray' | 'stage'; last: Pt; lastT: number; vy: number }
  | { kind: 'scroll'; start: Pt; scrollStart: number };

const SLOP = 10; // px of movement before a touch stops being a tap

export class GestureTracker {
  private touches = new Map<number, Touch>();
  scrollX = 0;

  /** Finger down. */
  start(touch: number, p: Pt, t: number, w: World): GestureEvent[] {
    this.scrollX = Math.min(w.layout.scrollMax, Math.max(0, w.scrollX));
    if (p.y >= w.layout.tray.y) {
      const slot = slotAt(w.layout, p, this.scrollX);
      const id = slot >= 0 ? w.trayIds[slot]! : null;
      const free = id !== null && !w.onStage.includes(id);
      this.touches.set(touch, { kind: 'pendingTray', id: free ? id : null, slot, start: p, startT: t, scrollStart: this.scrollX });
      return [];
    }
    const spot = standingAt(w.layout, p, w.onStage.map((x) => x !== null));
    if (spot >= 0) {
      this.touches.set(touch, { kind: 'pendingStage', id: w.onStage[spot]!, start: p, startT: t, fired: false });
      return [];
    }
    this.touches.set(touch, { kind: 'pendingEmpty', start: p });
    return [];
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
      case 'pendingTray': {
        if (dist(s.start) <= SLOP) return [];
        const dx = p.x - s.start.x, dy = p.y - s.start.y;
        const horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
        if (s.id && !(horizontal && w.layout.scrollMax > 0 && dy > -SLOP * 2)) {
          this.touches.set(touch, { kind: 'drag', id: s.id, from: 'tray', last: p, lastT: t, vy: 0 });
          return [{ type: 'pickup', touch, creatureId: s.id, from: 'tray', p }];
        }
        if (w.layout.scrollMax > 0) {
          this.touches.set(touch, { kind: 'scroll', start: s.start, scrollStart: s.scrollStart });
          return this.scrollTo(s.scrollStart - dx, w);
        }
        return [];
      }
      case 'scroll':
        return this.scrollTo(s.scrollStart - (p.x - s.start.x), w);
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
      case 'pendingEmpty': return [{ type: 'tapEmpty' }];
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
  tick(t: number): GestureEvent[] {
    const out: GestureEvent[] = [];
    for (const s of this.touches.values()) {
      if (s.kind === 'pendingStage' && !s.fired && t - s.startT >= TUNING.longPressMs) {
        s.fired = true;
        out.push({ type: 'longPress', creatureId: s.id });
      }
    }
    return out;
  }
  get hasPendingLongPress(): boolean {
    for (const s of this.touches.values()) if (s.kind === 'pendingStage' && !s.fired) return true;
    return false;
  }

  private scrollTo(x: number, w: World): GestureEvent[] {
    this.scrollX = Math.min(w.layout.scrollMax, Math.max(0, x));
    return [{ type: 'scroll', scrollX: this.scrollX }];
  }
}
