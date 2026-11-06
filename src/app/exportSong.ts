import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { AudioEngine } from '../core/engine';
import { renderSong, samplesPerBar } from '../core/render';
import type { Song } from '../core/timeline';
import { TUNING } from '../core/tuning';
import type { Stage } from '../core/types';
import { encodeWav } from '../core/wav';

export type ExportResult = 'shared' | 'storage' | 'unavailable' | 'error';

/** Renders the song offline (same code path as playback logic) and opens the share sheet. WAV 48 kHz 16-bit mono. */
export async function exportSong(engine: AudioEngine, stage: Stage, song: Song): Promise<ExportResult> {
  try {
    const files = [...stage.creatures.map((c) => c.loopFile), ...stage.combos.map((c) => c.bonusLoopFile)];
    const bank = await engine.decodeBank(files, samplesPerBar(stage.bpm) * stage.loopBars);
    const { samples } = renderSong(stage, song, bank);
    const safe = song.name.replace(/[\\/:*?"<>|]/g, '_');
    const file = new File(Paths.cache, `Hummlings - ${safe}.wav`);
    try {
      if (file.exists) file.delete();
      file.create();
      file.write(encodeWav(samples, TUNING.sampleRate));
    } catch {
      return 'storage'; // low storage: nothing is lost, the song stays in the list
    }
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    await Sharing.shareAsync(file.uri, { mimeType: 'audio/wav', dialogTitle: song.name });
    return 'shared';
  } catch {
    return 'error';
  }
}
