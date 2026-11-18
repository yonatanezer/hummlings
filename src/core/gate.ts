export interface Gate { a: number; b: number; options: number[]; correct: number }

/** Parental gate sum: a number from 11 to 19 plus one from 3 to 9 (too much for a child who is not yet in school, easy for a grown-up), 3 answer choices. rand() must return [0,1). */
export function makeGate(rand: () => number = Math.random): Gate {
  const a = 11 + Math.floor(rand() * 9);
  const b = 3 + Math.floor(rand() * 7);
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
