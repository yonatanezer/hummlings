/** The languages the app is translated into (see src/i18n). `ar` and `he` are written right to left. */
export const LANGS = ['en', 'he', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'ar', 'zh', 'ja', 'ko'] as const;
export type Lang = (typeof LANGS)[number];
export const isLang = (x: unknown): x is Lang => typeof x === 'string' && (LANGS as readonly string[]).includes(x);
export const RTL_LANGS: readonly Lang[] = ['he', 'ar'];
