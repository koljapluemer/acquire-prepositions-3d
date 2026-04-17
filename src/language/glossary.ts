import rawGlosses from '@public/data/data.json';
import rawLanguages from '@public/data/languages.json';
import type { GlossKey, LanguageCode } from '../types.ts';

export interface LanguageOption {
  code: LanguageCode;
  displayName: string;
}

type Glosses = Record<GlossKey, Partial<Record<LanguageCode, string>>>;
type Languages = Record<LanguageCode, string>;

const glosses = rawGlosses as Glosses;
const languages = rawLanguages as Languages;

export const DEFAULT_LANGUAGE: LanguageCode = 'deu'

export function getLanguageOptions(): LanguageOption[] {
  return Object.entries(languages).map(([code, displayName]) => ({
    code,
    displayName,
  }));
}

export function hasGloss(glossKey: GlossKey, language: LanguageCode): boolean {
  return Boolean(glosses[glossKey]?.[language]);
}

export function getGloss(glossKey: GlossKey, language: LanguageCode): string {
  return glosses[glossKey]?.[language] ?? glosses[glossKey]?.eng ?? glossKey;
}

export function getGlossKeysWithLanguage(glossKeys: GlossKey[], language: LanguageCode): GlossKey[] {
  return glossKeys.filter((glossKey) => hasGloss(glossKey, language));
}
