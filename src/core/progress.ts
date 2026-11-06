import type { Song } from './timeline';
import { TUNING } from './tuning';

export interface Progress {
  version: 1;
  discoveredCombos: string[]; // stable combo ids
  songs: Song[];
  unlocked: boolean; // cached entitlement
  settings: Settings;
  firstDropDone: boolean;
  helpSeen: boolean; // the how-to-play guide was opened at least once
}

export interface Settings {
  musicVolume: number; // 0..1
  haptics: boolean;
  reduceMotion: boolean; // forced on; otherwise follows system
  language: 'system' | 'en' | 'he';
}

export const defaultProgress = (): Progress => ({
  version: 1,
  discoveredCombos: [],
  songs: [],
  unlocked: false,
  settings: { musicVolume: 0.8, haptics: true, reduceMotion: false, language: 'system' },
  firstDropDone: false,
  helpSeen: false,
});

/** Tolerant loader: unknown / corrupt data becomes defaults, known fields are kept. */
export function parseProgress(raw: unknown): Progress {
  const d = defaultProgress();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<Progress>;
  const s = (r.settings ?? {}) as Partial<Settings>;
  return {
    version: 1,
    discoveredCombos: Array.isArray(r.discoveredCombos) ? r.discoveredCombos.filter((x) => typeof x === 'string') : [],
    songs: Array.isArray(r.songs) ? (r.songs.filter((x) => x && typeof x === 'object' && typeof (x as Song).id === 'string') as Song[]).slice(0, TUNING.maxSongs) : [],
    unlocked: r.unlocked === true,
    settings: {
      musicVolume: typeof s.musicVolume === 'number' ? Math.min(1, Math.max(0, s.musicVolume)) : d.settings.musicVolume,
      haptics: s.haptics !== false,
      reduceMotion: s.reduceMotion === true,
      language: s.language === 'en' || s.language === 'he' ? s.language : 'system',
    },
    firstDropDone: r.firstDropDone === true,
    helpSeen: r.helpSeen === true,
  };
}

export const canRecordMore = (p: Progress): boolean => p.songs.length < TUNING.maxSongs;
