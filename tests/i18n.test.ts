import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { he } from '../src/i18n/he';
import { resolveLang, setLang, t } from '../src/i18n';

describe('strings', () => {
  it('both languages have identical keys and no empty values', () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      expect(en[k].length).toBeGreaterThan(0);
      expect(he[k].length).toBeGreaterThan(0);
      expect((en[k].match(/\{\w+\}/g) ?? []).sort()).toEqual((he[k].match(/\{\w+\}/g) ?? []).sort());
    }
  });
  it('interpolates and switches language', () => {
    setLang('en');
    expect(t('songs.bars', { n: 8 })).toBe('8 bars');
    setLang('he');
    expect(t('songs.bars', { n: 8 })).toBe('8 תיבות');
    setLang('en');
  });
  it('resolves system locale', () => {
    expect(resolveLang('system', 'he-IL')).toBe('he');
    expect(resolveLang('system', 'fr-FR')).toBe('en');
    expect(resolveLang('he', 'en-US')).toBe('he');
  });
});
