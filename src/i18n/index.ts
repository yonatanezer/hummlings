import { en, type StringKey } from './en';
import { he } from './he';
import { es } from './es';
import { fr } from './fr';
import { de } from './de';
import { pt } from './pt';
import { it } from './it';
import { ru } from './ru';
import { ar } from './ar';
import { zh } from './zh';
import { ja } from './ja';
import { ko } from './ko';
import { isLang, RTL_LANGS, type Lang } from '../core/langs';

export type { Lang, StringKey };

const dicts: Record<Lang, Record<StringKey, string>> = { en, he, es, fr, de, pt, it, ru, ar, zh, ja, ko };
let current: Lang = 'en';
const listeners = new Set<() => void>();

export const getLang = (): Lang => current;
export const isRtl = (lang: Lang = current): boolean => RTL_LANGS.includes(lang);
export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  listeners.forEach((l) => l());
}
export function subscribeLang(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
/** Resolves the user's choice (system / a language) and the device locale ("he", "iw-IL", "pt-BR", "zh-Hans-CN"...) to a supported language; anything else falls back to English. */
export const resolveLang = (choice: 'system' | Lang, deviceLocale: string): Lang => {
  if (choice !== 'system') return choice;
  const code = deviceLocale.toLowerCase().split(/[-_]/)[0] ?? '';
  const mapped = code === 'iw' ? 'he' : code === 'no' || code === 'nb' ? 'en' : code;
  return isLang(mapped) ? mapped : 'en';
};

/** Typed translate: a missing key is a compile error. {name} placeholders are replaced from `vars`. */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let s = dicts[current][key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
