import { en, type StringKey } from './en';
import { he } from './he';

export type Lang = 'en' | 'he';
export type { StringKey };

const dicts: Record<Lang, Record<StringKey, string>> = { en, he };
let current: Lang = 'en';
const listeners = new Set<() => void>();

export const getLang = (): Lang => current;
export const isRtl = (lang: Lang = current): boolean => lang === 'he';
export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  listeners.forEach((l) => l());
}
export function subscribeLang(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
/** Resolves the user's choice (system / en / he) and the device locale to a supported language. */
export const resolveLang = (choice: 'system' | Lang, deviceLocale: string): Lang =>
  choice !== 'system' ? choice : deviceLocale.toLowerCase().startsWith('he') || deviceLocale.toLowerCase().startsWith('iw') ? 'he' : 'en';

/** Typed translate: a missing key is a compile error. {name} placeholders are replaced from `vars`. */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let s = dicts[current][key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
