import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { AudioEngine } from '../core/engine';
import { renderSong, samplesPerBar } from '../core/render';
import { defaultNameNumber, type Song } from '../core/timeline';
import { t } from '../i18n';
import { TUNING } from '../core/tuning';
import type { Stage } from '../core/types';
import { encodeWav } from '../core/wav';

export type ExportResult = 'shared' | 'saved' | 'cancelled' | 'storage' | 'unavailable' | 'error';

/** A file name every share target and file system accepts: default names ("Song 3" / "שיר 3") become "Song 3"; typed names keep their letters but lose characters that are not allowed, and an empty result falls back to "Song". */
const fileSafeName = (name: string): string => {
  const n = defaultNameNumber(name);
  if (n !== null) return `Song ${n}`;
  const cleaned = name.replace(/\p{Cc}/gu, '').replace(/[\\/:*?"<>|]/g, '_').replace(/[. ]+$/g, '').trim();
  return cleaned || 'Song';
};

/** Renders the song offline (the same code path as playback) into a WAV file in the cache. WAV 48 kHz 16-bit mono. */
async function renderToFile(engine: AudioEngine, stage: Stage, song: Song): Promise<File | 'storage' | 'error'> {
  try {
    const files = [...stage.creatures.map((c) => c.loopFile), ...stage.combos.map((c) => c.bonusLoopFile)];
    const bank = await engine.decodeBank(files, samplesPerBar(stage.bpm) * stage.loopBars);
    const { samples } = renderSong(stage, song, bank);
    const file = new File(Paths.cache, `Hummlings - ${fileSafeName(song.name)}.wav`);
    try {
      if (file.exists) file.delete();
      file.create();
      file.write(encodeWav(samples, TUNING.sampleRate));
    } catch {
      return 'storage'; // low storage: nothing is lost, the song stays in the list
    }
    return file;
  } catch {
    return 'error';
  }
}

/** Opens the system share sheet with the song as an audio file. */
export async function exportSong(engine: AudioEngine, stage: Stage, song: Song): Promise<ExportResult> {
  const file = await renderToFile(engine, stage, song);
  if (typeof file === 'string') return file;
  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    await Sharing.shareAsync(file.uri, { mimeType: 'audio/wav', dialogTitle: t('songs.shareTitle') });
    return 'shared';
  } catch {
    return 'error';
  }
}

/** Saves the song as an audio file in a folder the person picks (Files on iPhone, any folder on Android). No storage permission needed. */
export async function saveSongToDevice(engine: AudioEngine, stage: Stage, song: Song): Promise<ExportResult> {
  const file = await renderToFile(engine, stage, song);
  if (typeof file === 'string') return file;
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return 'cancelled';
  }
  try {
    file.copy(dir);
    return 'saved';
  } catch {
    return 'storage';
  }
}
