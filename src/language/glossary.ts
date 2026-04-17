import rawGlosses from '@public/data/data.json';
import rawLanguages from '@public/data/languages.json';
import type { GlossKey, LanguageCode } from '../types.ts';

export interface LanguageOption {
  code: LanguageCode;
  displayName: string;
}

interface GlossEntry {
  [key: string]: unknown;
  audio?: Partial<Record<LanguageCode, string>>;
}

export interface GlossPrompt {
  text: string;
  audioUrl: string | null;
}

type Glosses = Record<GlossKey, GlossEntry>;
type Languages = Record<LanguageCode, string>;

const glosses = rawGlosses as Glosses;
const languages = rawLanguages as Languages;

export const DEFAULT_LANGUAGE: LanguageCode = 'deu';

export function getLanguageOptions(): LanguageOption[] {
  return Object.entries(languages).map(([code, displayName]) => ({
    code,
    displayName,
  }));
}

export function hasGloss(glossKey: GlossKey, language: LanguageCode): boolean {
  return typeof glosses[glossKey]?.[language] === 'string';
}

export function getGloss(glossKey: GlossKey, language: LanguageCode): string {
  const entry = glosses[glossKey];
  const localized = entry?.[language];
  const english = entry?.eng;
  if (typeof localized === 'string') return localized;
  if (typeof english === 'string') return english;
  return glossKey;
}

export function getGlossAudioUrl(glossKey: GlossKey, language: LanguageCode): string | null {
  const audioPath = glosses[glossKey]?.audio?.[language];
  if (!audioPath) return null;
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${baseUrl}data/${audioPath.replace(/^\/+/, '')}`;
}

export function getGlossPrompt(glossKey: GlossKey, language: LanguageCode): GlossPrompt {
  return {
    text: getGloss(glossKey, language),
    audioUrl: getGlossAudioUrl(glossKey, language),
  };
}

export function getGlossKeysWithLanguage(glossKeys: GlossKey[], language: LanguageCode): GlossKey[] {
  return glossKeys.filter((glossKey) => hasGloss(glossKey, language));
}
