import type { StageState } from '../core/stageState';

const memory = new Map<string, StageState>();

/** Remembers each world's band while the app is open, so leaving a stage (back, help, songs) never loses what a child built. */
export const rememberBand = (stageId: string, state: StageState): void => { memory.set(stageId, state); };
export const recallBand = (stageId: string): StageState | undefined => memory.get(stageId);
