import rawGlosses from './data.json';
import rawLanguages from './languages.json';
import type { GlossKey, LanguageCode } from '../types.ts';

interface LanguageMetadata {
  displayName: string;
  symbols: string[];
}

export interface LanguageOption extends LanguageMetadata {
  code: LanguageCode;
}

type Glosses = Record<GlossKey, Partial<Record<LanguageCode, string>>>;
type Languages = Record<LanguageCode, LanguageMetadata>;

const glosses = rawGlosses as Glosses;
const languages = rawLanguages as Languages;

export const DEFAULT_LANGUAGE: LanguageCode = languages.deu ? 'deu' : Object.keys(languages)[0] ?? 'eng';

export function getLanguageOptions(): LanguageOption[] {
  return Object.entries(languages).map(([code, metadata]) => ({
    code,
    ...metadata,
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
