import { getUnlockedDropZones } from '../interaction/drop-zone-registry.ts';
import { DesktopDragInput } from '../interaction/input/desktop-drag-input.ts';
import { VrDragInput } from '../interaction/input/vr-drag-input.ts';
import { MugDragController } from '../interaction/mug-drag-controller.ts';
import type { DragInputAdapter, MugEl, SceneEl } from '../interaction/types.ts';

interface DraggableInstance {
  el: MugEl;
  controller: MugDragController;
  desktopInput: DragInputAdapter;
  vrInput: VrDragInput;
  setInteractionEnabled(enabled: boolean): void;
  snapBack(): void;
  resetToStartWithFade(onComplete?: () => void): void;
}

export function registerDraggable(): void {
  if (AFRAME.components['draggable']) return;

  AFRAME.registerComponent('draggable', {
    controller: null as unknown as MugDragController,
    desktopInput: null as unknown as DragInputAdapter,
    vrInput: null as unknown as VrDragInput,

    init(this: DraggableInstance) {
      const sceneEl = this.el.sceneEl as SceneEl;

      this.controller = new MugDragController({
        mugEl: this.el,
        sceneEl,
        getDropZones: getUnlockedDropZones,
        refreshInputRaycasters: () => this.vrInput?.refreshRaycasters(),
      });

      this.desktopInput = new DesktopDragInput({
        sceneEl,
        emit: (event) => this.controller.handleInput(event),
      });

      this.vrInput = new VrDragInput({
        mugEl: this.el,
        sceneEl,
        emit: (event) => this.controller.handleInput(event),
      });
    },

    remove(this: DraggableInstance) {
      this.desktopInput.dispose();
      this.vrInput.dispose();
      this.controller.dispose();
    },

    tick(this: DraggableInstance, time: number, delta: number) {
      this.vrInput.tick();
      this.controller.tick(time, delta);
    },

    setInteractionEnabled(this: DraggableInstance, enabled: boolean) {
      this.controller.setInteractionEnabled(enabled);
    },

    snapBack(this: DraggableInstance) {
      this.controller.snapBack();
    },

    resetToStartWithFade(this: DraggableInstance, onComplete?: () => void) {
      this.controller.resetToStartWithFade(onComplete);
    },
  });
}
