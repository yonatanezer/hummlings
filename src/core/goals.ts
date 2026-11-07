import { audibleIds, type StageAction, type StageState } from './stageState';
import { LAYERS, type Layer, type Stage } from './types';

/** Honest, no-timer mini goals for each world. Each one is a sticker in the sticker book. */
export const GOAL_IDS = ['fullBand', 'drumCircle', 'choir', 'fullStage', 'soloist', 'mixMaster', 'swapper', 'twoCombos'] as const;
export type GoalId = (typeof GOAL_IDS)[number];

export const goalKey = (stageId: string, g: GoalId): string => `${stageId}:${g}`;

/** How far along a goal is (n of total), for the sticker book. */
export interface GoalProgress { id: GoalId; done: boolean; n: number; total: number }

export class GoalTracker {
  private done = new Set<string>();
  private soloLayers = new Set<Layer>();
  private muteToggles = 0;
  private swaps = 0;
  constructor(readonly stage: Stage, done: Iterable<string> = []) { for (const d of done) this.done.add(d); }

  isDone = (g: GoalId): boolean => this.done.has(goalKey(this.stage.id, g));
  get completed(): string[] { return [...this.done]; }

  /** Feed every user action (before the reducer applies it) so counters can follow. */
  onAction(a: StageAction, before: StageState): void {
    const layerOf = (id: string): Layer | undefined => this.stage.creatures.find((c) => c.id === id)?.layer;
    if (a.kind === 'mute' && before.spots.includes(a.creatureId)) this.muteToggles++;
    if (a.kind === 'drop' && before.spots[a.spot] && before.spots[a.spot] !== a.creatureId) this.swaps++;
    if (a.kind === 'solo' && before.solo !== a.creatureId && before.spots.includes(a.creatureId)) {
      const l = layerOf(a.creatureId);
      if (l) this.soloLayers.add(l);
    }
  }

  progress(state: StageState, discoveredInStage: number): GoalProgress[] {
    const per = this.layerCounts(state);
    const occupied = state.spots.filter(Boolean).length;
    const audible = audibleIds(state).length;
    const mk = (id: GoalId, n: number, total: number): GoalProgress => ({ id, n: Math.min(n, total), total, done: this.isDone(id) });
    return [
      mk('fullBand', LAYERS.filter((l) => per[l] > 0).length, 4),
      mk('drumCircle', per.drums, 3),
      mk('choir', per.voice, 3),
      mk('fullStage', Math.min(occupied, audible), 6),
      mk('soloist', this.soloLayers.size, 4),
      mk('mixMaster', this.muteToggles, 5),
      mk('swapper', this.swaps, 3),
      mk('twoCombos', discoveredInStage, 2),
    ];
  }

  /** Evaluate at a bar boundary; returns goal keys completed just now. */
  check(state: StageState, discoveredInStage: number): string[] {
    const fresh: string[] = [];
    for (const p of this.progress(state, discoveredInStage)) {
      const reached = p.n >= p.total;
      const key = goalKey(this.stage.id, p.id);
      if (reached && !this.done.has(key)) { this.done.add(key); fresh.push(key); }
    }
    return fresh;
  }

  private layerCounts(state: StageState): Record<Layer, number> {
    const out: Record<Layer, number> = { drums: 0, bass: 0, melody: 0, voice: 0 };
    for (const id of audibleIds(state)) {
      const l = this.stage.creatures.find((c) => c.id === id)?.layer;
      if (l) out[l]++;
    }
    return out;
  }
}
