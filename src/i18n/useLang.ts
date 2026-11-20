import { useSyncExternalStore } from 'react';
import { getLang, isRtl, subscribeLang, type Lang } from './index';

/** Re-renders on language change; returns the language and whether layout should mirror. */
export function useLang(): { lang: Lang; rtl: boolean } {
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);
  return { lang, rtl: isRtl(lang) };
}
