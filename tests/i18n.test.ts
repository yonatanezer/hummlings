import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { isRtl, resolveLang, setLang, t } from '../src/i18n';

import * as dictsModule from './helpers/dicts';
import { LANGS } from '../src/core/langs';

const all = dictsModule.all;

describe('strings', () => {
  it('every language has identical keys, no empty values and the same placeholders', () => {
    for (const lang of LANGS) {
      const d = all[lang];
      expect(Object.keys(d).sort(), lang).toEqual(Object.keys(en).sort());
      for (const k of Object.keys(en) as (keyof typeof en)[]) {
        expect(d[k].length, `${lang}.${k}`).toBeGreaterThan(0);
        expect((d[k].match(/\{\w+\}/g) ?? []).sort(), `${lang}.${k} placeholders`).toEqual((en[k].match(/\{\w+\}/g) ?? []).sort());
      }
    }
  });
  it('language names are the same in every dictionary and the app name is never translated', () => {
    for (const lang of LANGS) {
      for (const l of LANGS) expect(all[lang][`settings.language.${l}` as keyof typeof en], `${lang}.settings.language.${l}`).toBe(en[`settings.language.${l}` as keyof typeof en]);
      expect(all[lang]['app.name']).toBe('Hummlings');
    }
  });
  it('button captions stay short enough for a 56 dp button', () => {
    for (const lang of LANGS) {
      for (const k of Object.keys(en).filter((x) => x.startsWith('ui.')) as (keyof typeof en)[]) expect(Array.from(all[lang][k]).length, `${lang}.${k}`).toBeLessThanOrEqual(14);
    }
  });
  it('interpolates and switches language', () => {
    setLang('en');
    expect(t('songs.bars', { n: 8 })).toBe('8 bars');
    setLang('he');
    expect(t('songs.bars', { n: 8 })).toBe('8 תיבות');
    setLang('en');
  });
  it('resolves the system locale', () => {
    expect(resolveLang('system', 'he-IL')).toBe('he');
    expect(resolveLang('system', 'iw')).toBe('he');
    expect(resolveLang('system', 'pt-BR')).toBe('pt');
    expect(resolveLang('system', 'zh-Hans-CN')).toBe('zh');
    expect(resolveLang('system', 'ar_EG')).toBe('ar');
    expect(resolveLang('system', 'sv-SE')).toBe('en');
    expect(resolveLang('system', '')).toBe('en');
    expect(resolveLang('he', 'en-US')).toBe('he');
    expect(isRtl('he')).toBe(true);
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('fr')).toBe(false);
  });
});

describe('help guide', () => {
  it('has a sentence for each of the 7 lessons in every language', () => {
    for (const lang of LANGS) for (let i = 1; i <= 7; i++) expect(all[lang][`help.step${i}` as keyof typeof en].length, `${lang} step ${i}`).toBeGreaterThan(5);
  });
});
