import { getGlossKeysWithLanguage, getGlossPrompt } from '../language/glossary.ts';
import type { ZoneId, GameState, GlossKey, LanguageCode, Zone } from '../types.ts';
import type { GlossPrompt } from '../language/glossary.ts';

const CORRECT_FEEDBACK_MS = 1500;
const LEARNING_EVENTS_STORAGE_KEY = 'acquire-prepositions-3d:learning-events';

interface MugEl extends Element {
  components: { draggable: { resetToStartWithFade: (onComplete?: () => void) => void; setInteractionEnabled: (enabled: boolean) => void; snapBack: () => void } };
}

interface DragEndDetail {
  el: MugEl;
  hoveredZoneEl: Element | null;
}

interface DropZoneComponent {
  data: { label: ZoneId };
  setUnlocked(unlocked: boolean): void;
}

interface LearningEvent {
  glossKey: GlossKey;
  language: LanguageCode;
  zoneId: ZoneId;
  completedAt: string;
}

type PendingFeedback =
  | { kind: 'correct'; sessionId: number; mugEl: MugEl; remainingMs: number }
  | { kind: 'wrong'; sessionId: number; remainingMs: number };

interface GameUI {
  setInstruction(prompt: GlossPrompt): void;
  showFeedback(text: string, type: 'success' | 'error'): void;
}

export class Game {
  private state: GameState = 'idle';
  private target: GlossKey = '';
  private unlockedZoneIds = new Set<ZoneId>();
  private completedGlossKeys = new Set<GlossKey>();
  private readonly ui: GameUI;
  private readonly sceneEl: Element;
  private readonly zones: Zone[];
  private readonly zonesById: Map<ZoneId, Zone>;
  private language: LanguageCode;
  private pendingFeedback: PendingFeedback | null = null;
  private sessionId = 0;

  constructor(opts: { ui: GameUI; sceneEl: Element; zones: Zone[]; language: LanguageCode }) {
    this.ui = opts.ui;
    this.sceneEl = opts.sceneEl;
    this.zones = opts.zones;
    this.zonesById = new Map(this.zones.map((zone) => [zone.key, zone]));
    this.language = opts.language;
    this.completedGlossKeys = this.loadCompletedGlossKeys();
    const { sceneEl } = opts;

    sceneEl.addEventListener('drag-end', (e: Event) => {
      const { el, hoveredZoneEl } = (e as CustomEvent<DragEndDetail>).detail;
      if (!hoveredZoneEl) {
        el.components.draggable.snapBack();
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zoneComponent = (hoveredZoneEl as any).components['drop-zone'] as DropZoneComponent | undefined;
      if (!zoneComponent) {
        el.components.draggable.snapBack();
        return;
      }
      this.handleDrop(zoneComponent.data.label, el);
    });

    this.setMugInteractionEnabled(false);
  }

  startRound(): void {
    if (this.state === 'idle') this.sessionId += 1;
    this.clearFeedbackTimer();
    this.state = 'playing';
    if (this.unlockedZoneIds.size === 0) {
      this.unlockRandomZone();
    }
    this.syncUnlockedZones();
    this.target = this.pickTaskFromUnlockedZones();
    this.ui.setInstruction(getGlossPrompt(this.target, this.language));
    this.setMugInteractionEnabled(true);
  }

  exitGame(): void {
    this.sessionId += 1;
    this.clearFeedbackTimer();
    this.state = 'idle';
    this.target = '';
    this.unlockedZoneIds.clear();
    this.setMugInteractionEnabled(false);
    this.syncUnlockedZones();
    this.resetMug();
  }

  setLanguage(language: LanguageCode): void {
    this.language = language;
    if (this.state !== 'idle') this.startRound();
  }

  tick(_time: number, delta: number): void {
    if (!this.pendingFeedback) return;
    this.pendingFeedback.remainingMs -= delta;
    if (this.pendingFeedback.remainingMs > 0) return;

    const pending = this.pendingFeedback;
    this.pendingFeedback = null;
    if (this.sessionId !== pending.sessionId || this.state === 'idle') return;

    if (pending.kind === 'correct') {
      pending.mugEl.components.draggable.resetToStartWithFade(() => {
        if (this.sessionId !== pending.sessionId || this.state === 'idle') return;
        if (this.allUnlockedTasksCompleted()) {
          this.unlockRandomZone();
        }
        this.startRound();
      });
      return;
    }

    this.state = 'playing';
    this.setMugInteractionEnabled(true);
  }

  private handleDrop(zoneId: ZoneId, mugEl: MugEl): void {
    if (this.state !== 'playing') return;
    this.state = 'feedback';
    this.setMugInteractionEnabled(false);

    const zone = this.zonesById.get(zoneId);
    if (zone?.glossKeys.includes(this.target)) {
      this.recordLearningEvent(zoneId);
      this.ui.showFeedback('Correct!', 'success');
      this.pendingFeedback = {
        kind: 'correct',
        sessionId: this.sessionId,
        mugEl,
        remainingMs: CORRECT_FEEDBACK_MS,
      };
    } else {
      this.ui.showFeedback('Try again!', 'error');
      mugEl.components.draggable.snapBack();
      this.pendingFeedback = {
        kind: 'wrong',
        sessionId: this.sessionId,
        remainingMs: 1000,
      };
    }
  }

  private clearFeedbackTimer(): void {
    this.pendingFeedback = null;
  }

  private resetMug(): void {
    const mugEl = this.sceneEl.querySelector('#mug') as MugEl | null;
    mugEl?.components.draggable.resetToStartWithFade();
  }

  private setMugInteractionEnabled(enabled: boolean): void {
    const mugEl = this.sceneEl.querySelector('#mug') as MugEl | null;
    mugEl?.components.draggable.setInteractionEnabled(enabled);
  }

  private pickTaskFromUnlockedZones(): GlossKey {
    const candidates = this.getUnlockedCandidateGlossKeys();
    if (candidates.length === 0) {
      throw new Error(`No unlocked zones have gloss data for language "${this.language}".`);
    }

    const uncompletedCandidates = candidates.filter((glossKey) => !this.completedGlossKeys.has(glossKey));
    const shouldPreferUncompleted = Math.random() < 0.5 && uncompletedCandidates.length > 0;
    const preferredCandidates = shouldPreferUncompleted ? uncompletedCandidates : candidates;
    const nonRepeatingCandidates = preferredCandidates.filter((glossKey) => glossKey !== this.target);
    const taskCandidates = this.target && nonRepeatingCandidates.length > 0
      ? nonRepeatingCandidates
      : preferredCandidates;
    return taskCandidates[Math.floor(Math.random() * taskCandidates.length)];
  }

  private getZoneCandidateGlossKeys(zone: Zone): GlossKey[] {
    return getGlossKeysWithLanguage(zone.glossKeys, this.language);
  }

  private getUnlockedCandidateGlossKeys(): GlossKey[] {
    return [...new Set(
      this.zones
        .filter((zone) => this.unlockedZoneIds.has(zone.key))
        .flatMap((zone) => this.getZoneCandidateGlossKeys(zone)),
    )];
  }

  private allUnlockedTasksCompleted(): boolean {
    const candidates = this.getUnlockedCandidateGlossKeys();
    return candidates.length > 0 && candidates.every((glossKey) => this.completedGlossKeys.has(glossKey));
  }

  private unlockRandomZone(): void {
    const lockedZones = this.zones.filter((zone) => !this.unlockedZoneIds.has(zone.key));
    if (lockedZones.length === 0) return;

    const zonesWithTasks = lockedZones.filter((zone) => this.getZoneCandidateGlossKeys(zone).length > 0);
    const candidates = zonesWithTasks.length > 0 ? zonesWithTasks : lockedZones;
    const zone = candidates[Math.floor(Math.random() * candidates.length)];
    this.unlockedZoneIds.add(zone.key);
  }

  private syncUnlockedZones(): void {
    this.zones.forEach((zone) => {
      const component = this.getDropZoneComponent(zone.key);
      component?.setUnlocked(this.unlockedZoneIds.has(zone.key));
    });
  }

  private getDropZoneComponent(zoneId: ZoneId): DropZoneComponent | null {
    const zoneEl = this.sceneEl.querySelector(`#zone-${zoneId}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((zoneEl as any)?.components?.['drop-zone'] as DropZoneComponent | undefined) ?? null;
  }

  private recordLearningEvent(zoneId: ZoneId): void {
    const events = this.loadLearningEvents();
    const event: LearningEvent = {
      glossKey: this.target,
      language: this.language,
      zoneId,
      completedAt: new Date().toISOString(),
    };
    events.push(event);
    this.completedGlossKeys.add(this.target);
    this.saveLearningEvents(events);
  }

  private loadCompletedGlossKeys(): Set<GlossKey> {
    return new Set(this.loadLearningEvents().map((event) => event.glossKey));
  }

  private loadLearningEvents(): LearningEvent[] {
    try {
      const rawEvents = window.localStorage.getItem(LEARNING_EVENTS_STORAGE_KEY);
      if (!rawEvents) return [];
      const events = JSON.parse(rawEvents);
      if (!Array.isArray(events)) return [];
      return events.filter((event): event is LearningEvent => (
        typeof event?.glossKey === 'string'
        && typeof event?.language === 'string'
        && typeof event?.zoneId === 'string'
        && typeof event?.completedAt === 'string'
      ));
    } catch {
      return [];
    }
  }

  private saveLearningEvents(events: LearningEvent[]): void {
    try {
      window.localStorage.setItem(LEARNING_EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch {
      // localStorage can fail in private browsing or when quota is exceeded.
    }
  }
}
