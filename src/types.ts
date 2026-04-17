export type ZoneId = string;
export type GlossKey = string;
export type LanguageCode = string;
export type GameState = 'playing' | 'feedback';

export interface Zone {
  key: ZoneId;
  pos: { x: number; y: number; z: number };
  glossKeys: GlossKey[];
}
