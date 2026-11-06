import { TUNING } from './tuning';

export interface Gate { a: number; b: number; options: number[]; correct: number }

/** Parental gate sum: two numbers shown as digits, 3 answer choices. rand() must return [0,1). */
export function makeGate(rand: () => number = Math.random): Gate {
  const span = TUNING.gateMaxAddend - 1;
  const a = 1 + Math.floor(rand() * span) + 1; // 2..9: always a digit, never trivially 1
  const b = 2 + Math.floor(rand() * span);
  const correct = a + b;
  const set = new Set<number>([correct]);
  while (set.size < 3) {
    const delta = (1 + Math.floor(rand() * 4)) * (rand() < 0.5 ? -1 : 1);
    const v = correct + delta;
    if (v > 0) set.add(v);
  }
  const options = [...set].sort(() => rand() - 0.5);
  return { a, b, options, correct };
}
