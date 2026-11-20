import { File, Paths } from 'expo-file-system';

const progressFile = () => new File(Paths.document, 'hummlings-progress.json');

export async function readProgressRaw(): Promise<unknown> {
  try {
    const f = progressFile();
    if (!f.exists) return null;
    return JSON.parse(await f.text());
  } catch {
    return null;
  }
}

/** Atomic-ish write: write a temp file then move it over the real one. Returns false on failure (e.g. storage full). */
export async function writeProgressRaw(data: unknown): Promise<boolean> {
  try {
    const tmp = new File(Paths.document, 'hummlings-progress.tmp');
    if (tmp.exists) tmp.delete();
    tmp.create();
    tmp.write(JSON.stringify(data));
    const dest = progressFile();
    if (dest.exists) dest.delete();
    tmp.move(dest);
    return true;
  } catch {
    return false;
  }
}
