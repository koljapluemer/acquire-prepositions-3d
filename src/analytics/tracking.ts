import { initializeApp } from 'firebase/app';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore/lite';
import type { GlossKey, LanguageCode, ZoneId } from '../types.ts';

const TRACKING_COLLECTION = 'prepositions-3d-data';
const USER_ID_STORAGE_KEY = 'acquire-prepositions-3d:user-id';
const PLAY_SESSION_INDEX_STORAGE_KEY = 'acquire-prepositions-3d:play-session-index';
const EVENT_SCHEMA_VERSION = 1;

const firebaseConfig = {
  apiKey: 'AIzaSyBZkv2DoGbp1kk0sxdg9T3o9Z22b0cIPg0',
  authDomain: 'tpr-game.firebaseapp.com',
  projectId: 'tpr-game',
  storageBucket: 'tpr-game.firebasestorage.app',
  messagingSenderId: '213328104326',
  appId: '1:213328104326:web:bf6defc7e291d5fe267a07',
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

let userIdPromise: Promise<string> | null = null;
let inMemoryPlaySessionIndex = 0;

export type InteractionMode = 'desktop' | 'vr';
export type TaskExecutionMode = InteractionMode | 'mixed';

export interface LearningTaskFinishedEvent {
  playSessionIndex: number;
  taskIndexInPlaySession: number;
  executionMode: TaskExecutionMode;
  taskStartedInteractionMode: InteractionMode;
  completedInteractionMode: InteractionMode;
  taskStartedAt: string;
  completedAt: string;
  timeOnTaskMs: number;
  audioReplayCount: number;
  triesUntilCorrect: number;
  language: LanguageCode;
  task: GlossKey;
  taskText: string;
  correctTargetId: ZoneId;
  correctTargetIds: ZoneId[];
  movedTargetIds: ZoneId[];
  wrongTargetIds: ZoneId[];
  unlockedTargetIds: ZoneId[];
  unlockedTaskIds: GlossKey[];
  wasPreviouslyCompleted: boolean;
  hadAudio: boolean;
}

export function nextPlaySessionIndex(): number {
  const storage = getLocalStorage();
  if (!storage) {
    inMemoryPlaySessionIndex += 1;
    return inMemoryPlaySessionIndex;
  }

  try {
    const currentValue = Number(storage.getItem(PLAY_SESSION_INDEX_STORAGE_KEY) ?? '0');
    const nextValue = Number.isFinite(currentValue) && currentValue >= 0 ? currentValue + 1 : 1;
    storage.setItem(PLAY_SESSION_INDEX_STORAGE_KEY, String(nextValue));
    return nextValue;
  } catch {
    inMemoryPlaySessionIndex += 1;
    return inMemoryPlaySessionIndex;
  }
}

export function trackLearningTaskFinished(event: LearningTaskFinishedEvent): void {
  void writeTrackingEvent({
    eventType: 'learning_task_finished',
    ...event,
  });
}

async function writeTrackingEvent(event: Record<string, unknown>): Promise<void> {
  try {
    const userId = await getOrCreateUserId();
    await addDoc(collection(firestore, TRACKING_COLLECTION), {
      ...event,
      userId,
      schemaVersion: EVENT_SCHEMA_VERSION,
      clientTimestamp: new Date().toISOString(),
      serverTimestamp: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Could not record tracking event.', error);
  }
}

function getOrCreateUserId(): Promise<string> {
  if (!userIdPromise) userIdPromise = readOrCreateUserId();
  return userIdPromise;
}

async function readOrCreateUserId(): Promise<string> {
  const storage = getLocalStorage();
  if (!storage) {
    throw new Error('localStorage is required to persist the analytics user id.');
  }

  const storedUserId = storage.getItem(USER_ID_STORAGE_KEY);
  if (storedUserId) return storedUserId;

  const generatedUserId = await createHashedUserId();
  storage.setItem(USER_ID_STORAGE_KEY, generatedUserId);
  return generatedUserId;
}

async function createHashedUserId(): Promise<string> {
  if (!window.crypto?.subtle) {
    throw new Error('Web Crypto is required to create a hashed analytics user id.');
  }

  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  const digest = await window.crypto.subtle.digest('SHA-256', randomBytes);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
