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

let glosses: Glosses | null = null;
let languages: Languages | null = null;

export const DEFAULT_LANGUAGE: LanguageCode = 'deu';

export async function loadGlossaryData(): Promise<void> {
  const [loadedGlosses, loadedLanguages] = await Promise.all([
    fetchJson<Glosses>('data.json'),
    fetchJson<Languages>('languages.json'),
  ]);
  glosses = loadedGlosses;
  languages = loadedLanguages;
}

export function getLanguageOptions(): LanguageOption[] {
  return Object.entries(getLanguages()).map(([code, displayName]) => ({
    code,
    displayName,
  }));
}

export function hasGloss(glossKey: GlossKey, language: LanguageCode): boolean {
  return typeof getGlosses()[glossKey]?.[language] === 'string';
}

export function getGloss(glossKey: GlossKey, language: LanguageCode): string {
  const entry = getGlosses()[glossKey];
  const localized = entry?.[language];
  const english = entry?.eng;
  if (typeof localized === 'string') return localized;
  if (typeof english === 'string') return english;
  return glossKey;
}

export function getGlossAudioUrl(glossKey: GlossKey, language: LanguageCode): string | null {
  const audioPath = getGlosses()[glossKey]?.audio?.[language];
  if (!audioPath) return null;
  return getPublicDataUrl(audioPath);
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

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(getPublicDataUrl(path));
  if (!response.ok) {
    throw new Error(`Failed to load glossary data "${path}": ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function getPublicDataUrl(path: string): string {
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${baseUrl}data/${path.replace(/^\/+/, '')}`;
}

function getGlosses(): Glosses {
  if (!glosses) throw new Error('Glossary data has not loaded.');
  return glosses;
}

function getLanguages(): Languages {
  if (!languages) throw new Error('Language data has not loaded.');
  return languages;
}
