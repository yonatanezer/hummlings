import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { defaultProgress, parseProgress, type Progress, type Settings } from '../core/progress';
import type { Song } from '../core/timeline';
import { readProgressRaw, writeProgressRaw } from './storage';

interface Ctx {
  progress: Progress;
  ready: boolean;
  saveFailed: boolean;
  update: (fn: (p: Progress) => Progress) => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  addSong: (s: Song) => boolean;
  discover: (comboId: string) => void;
  reset: () => void;
}

const ProgressCtx = createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(defaultProgress());
  const [ready, setReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const latest = useRef(progress);
  latest.current = progress;

  useEffect(() => {
    void readProgressRaw().then((raw) => {
      const p = parseProgress(raw);
      latest.current = p;
      setProgress(p);
      setReady(true);
    });
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => {
    const next = fn(latest.current);
    latest.current = next;
    setProgress(next);
    void writeProgressRaw(next).then((ok) => setSaveFailed(!ok));
  }, []);

  const value = useMemo<Ctx>(() => ({
    progress, ready, saveFailed, update,
    setSetting: (k, v) => update((p) => ({ ...p, settings: { ...p.settings, [k]: v } })),
    addSong: (s) => {
      if (latest.current.songs.length >= 50) return false;
      update((p) => ({ ...p, songs: [...p.songs, s] }));
      return true;
    },
    discover: (id) => update((p) => (p.discoveredCombos.includes(id) ? p : { ...p, discoveredCombos: [...p.discoveredCombos, id] })),
    reset: () => update((p) => ({ ...defaultProgress(), unlocked: p.unlocked, settings: p.settings, firstDropDone: true })),
  }), [progress, ready, saveFailed, update]);

  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export function useProgress(): Ctx {
  const c = useContext(ProgressCtx);
  if (!c) throw new Error('ProgressProvider missing');
  return c;
}
