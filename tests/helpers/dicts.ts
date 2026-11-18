import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';
import { es } from '../../src/i18n/es';
import { fr } from '../../src/i18n/fr';
import { de } from '../../src/i18n/de';
import { pt } from '../../src/i18n/pt';
import { it } from '../../src/i18n/it';
import { ru } from '../../src/i18n/ru';
import { ar } from '../../src/i18n/ar';
import { zh } from '../../src/i18n/zh';
import { ja } from '../../src/i18n/ja';
import { ko } from '../../src/i18n/ko';
import type { Lang } from '../../src/core/langs';

export const all: Record<Lang, Record<keyof typeof en, string>> = { en, he, es, fr, de, pt, it, ru, ar, zh, ja, ko };
