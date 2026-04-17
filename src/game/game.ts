import { getGloss, getGlossKeysWithLanguage } from '../language/glossary.ts';
import type { ZoneId, GameState, GlossKey, LanguageCode, Zone } from '../types.ts';
import type { HUD } from '../ui/hud.ts';

const CORRECT_FEEDBACK_MS = 1500;

interface MugEl extends Element {
  components: { draggable: { resetToStartWithFade: (onComplete?: () => void) => void; snapBack: () => void } };
}

interface DragEndDetail {
  el: MugEl;
  hoveredZoneEl: Element | null;
}

interface ZoneDropDetail {
  zoneId: ZoneId;
  el: MugEl;
}

export class Game {
  private state: GameState = 'playing';
  private target: GlossKey = '';
  private readonly hud: HUD;
  private readonly zones: Zone[];
  private readonly zonesById: Map<ZoneId, Zone>;
  private language: LanguageCode;

  constructor(opts: { hud: HUD; sceneEl: Element; zones: Zone[]; language: LanguageCode }) {
    this.hud = opts.hud;
    this.zones = opts.zones;
    this.zonesById = new Map(this.zones.map((zone) => [zone.key, zone]));
    this.language = opts.language;
    const { sceneEl } = opts;

    sceneEl.addEventListener('drag-end', (e: Event) => {
      const { el, hoveredZoneEl } = (e as CustomEvent<DragEndDetail>).detail;
      if (!hoveredZoneEl) el.components.draggable.snapBack();
      // if hoveredZoneEl is set, zone-drop fires synchronously next
    });

    sceneEl.addEventListener('zone-drop', (e: Event) => {
      const { zoneId, el } = (e as CustomEvent<ZoneDropDetail>).detail;
      this.handleDrop(zoneId, el);
    });
  }

  startRound(): void {
    this.state = 'playing';
    const candidates = this.getCandidateGlossKeys();
    this.target = candidates[Math.floor(Math.random() * candidates.length)];
    this.hud.setInstruction(getGloss(this.target, this.language));
  }

  setLanguage(language: LanguageCode): void {
    this.language = language;
    this.startRound();
  }

  private handleDrop(zoneId: ZoneId, mugEl: MugEl): void {
    if (this.state !== 'playing') return;
    this.state = 'feedback';

    const zone = this.zonesById.get(zoneId);
    if (zone?.glossKeys.includes(this.target)) {
      this.hud.showFeedback('Correct!', 'success');
      setTimeout(() => {
        mugEl.components.draggable.resetToStartWithFade(() => this.startRound());
      }, CORRECT_FEEDBACK_MS);
    } else {
      this.hud.showFeedback('Try again!', 'error');
      mugEl.components.draggable.snapBack();
      setTimeout(() => { this.state = 'playing'; }, 1000);
    }
  }

  private getCandidateGlossKeys(): GlossKey[] {
    const uniqueGlossKeys = [...new Set(this.zones.flatMap((zone) => zone.glossKeys))];
    const candidates = getGlossKeysWithLanguage(uniqueGlossKeys, this.language);
    if (candidates.length === 0) {
      throw new Error(`No gloss data found for language "${this.language}".`);
    }
    return candidates;
  }
}
