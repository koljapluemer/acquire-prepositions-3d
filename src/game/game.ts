import type { ZoneId, GameState } from '../types.ts';
import type { HUD } from '../ui/hud.ts';

interface MugEl extends Element {
  components: { draggable: { snapBack: () => void } };
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
  private target: ZoneId = 'table';
  private readonly hud: HUD;

  constructor(opts: { hud: HUD; sceneEl: Element }) {
    this.hud = opts.hud;
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
    this.target = Math.random() < 0.5 ? 'table' : 'chair';
    this.hud.setInstruction(`Place the mug on the ${this.target}`);
  }

  private handleDrop(zoneId: ZoneId, mugEl: MugEl): void {
    if (this.state !== 'playing') return;
    this.state = 'feedback';

    if (zoneId === this.target) {
      this.hud.showFeedback('Correct! ✓', 'success');
      setTimeout(() => this.startRound(), 1500);
    } else {
      this.hud.showFeedback('Try again!', 'error');
      mugEl.components.draggable.snapBack();
      setTimeout(() => { this.state = 'playing'; }, 1000);
    }
  }
}
