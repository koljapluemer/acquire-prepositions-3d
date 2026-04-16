import type { ZoneId, GameState } from '../types.ts';
import type { HUD } from '../ui/hud.ts';

interface ZoneDropDetail {
  zoneId: ZoneId;
  el: Element & { components: { draggable: { snapBack: () => void } } };
}

interface DragEndDetail {
  el: Element & { components: { draggable: { snapBack: () => void } } };
}

export class Game {
  private state: GameState = 'playing';
  private target: ZoneId = 'table';
  private dropHandled = false;
  private readonly hud: HUD;
  private readonly sceneEl: Element;

  constructor(opts: { hud: HUD; sceneEl: Element }) {
    this.hud = opts.hud;
    this.sceneEl = opts.sceneEl;

    this.sceneEl.addEventListener('drag-end', (e: Event) => {
      this.dropHandled = false;
      const detail = (e as CustomEvent).detail as DragEndDetail;
      // Give zone-drop a chance to fire synchronously before snapping back
      setTimeout(() => {
        if (!this.dropHandled) detail.el.components.draggable.snapBack();
      }, 0);
    });

    this.sceneEl.addEventListener('zone-drop', (e: Event) => {
      this.dropHandled = true;
      const { zoneId, el } = (e as CustomEvent).detail as ZoneDropDetail;
      this.handleDrop(zoneId, el);
    });
  }

  startRound(): void {
    this.state = 'playing';
    this.target = Math.random() < 0.5 ? 'table' : 'chair';
    this.hud.setInstruction(`Place the mug on the ${this.target}`);
  }

  private handleDrop(
    zoneId: ZoneId,
    mugEl: Element & { components: { draggable: { snapBack: () => void } } },
  ): void {
    if (this.state !== 'playing') return;
    this.state = 'feedback';

    if (zoneId === this.target) {
      this.hud.showFeedback('Correct! ✓', 'success');
      setTimeout(() => this.startRound(), 1500);
    } else {
      this.hud.showFeedback('Try again!', 'error');
      mugEl.components.draggable.snapBack();
      setTimeout(() => {
        this.state = 'playing';
      }, 1000);
    }
  }
}
