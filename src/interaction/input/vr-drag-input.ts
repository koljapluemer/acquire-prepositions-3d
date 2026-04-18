import type * as THREE from 'three';
import type { ControllerEl, DragInputAdapter, DragInputEvent, MugEl, SceneEl } from '../types.ts';

interface CursorEventDetail {
  cursorEl?: Element;
}

export class VrDragInput implements DragInputAdapter {
  private readonly controllerEls: ControllerEl[];
  private activeControllerEl: ControllerEl | null = null;
  private readonly opts: {
    mugEl: MugEl;
    sceneEl: SceneEl;
    emit: (event: DragInputEvent) => void;
  };

  private readonly onMugCursorMouseDown = (evt: Event) => {
    if (!this.sceneEl.is('vr-mode')) return;
    const controllerEl = this.getCursorController(evt);
    if (!controllerEl) return;
    this.activeControllerEl = controllerEl;
    this.emit({ type: 'start', sourceId: controllerEl.id, ray: this.getControllerRay(controllerEl) });
  };

  private readonly onMugCursorMouseUp = (evt: Event) => {
    if (!this.sceneEl.is('vr-mode')) return;
    const controllerEl = this.getCursorController(evt);
    if (!controllerEl) return;
    this.end(controllerEl);
  };

  private readonly onControllerRelease = (evt: Event) => {
    const controllerEl = evt.currentTarget as ControllerEl | null;
    if (!controllerEl) return;
    this.end(controllerEl);
  };

  private readonly onControllerDisconnected = (evt: Event) => {
    const controllerEl = evt.currentTarget as ControllerEl | null;
    if (!controllerEl || controllerEl !== this.activeControllerEl) return;
    this.emit({ type: 'cancel', sourceId: controllerEl.id, reason: 'controllerdisconnected' });
    this.activeControllerEl = null;
  };

  private readonly onSceneExitVr = () => {
    if (!this.activeControllerEl) return;
    this.emit({ type: 'cancel', sourceId: this.activeControllerEl.id, reason: 'exit-vr' });
    this.activeControllerEl = null;
  };

  constructor(opts: {
    mugEl: MugEl;
    sceneEl: SceneEl;
    emit: (event: DragInputEvent) => void;
  }) {
    this.opts = opts;
    this.controllerEls = Array.from(document.querySelectorAll('#left-controller, #right-controller')) as ControllerEl[];
    this.opts.mugEl.addEventListener('mousedown', this.onMugCursorMouseDown);
    this.opts.mugEl.addEventListener('mouseup', this.onMugCursorMouseUp);
    this.opts.sceneEl.addEventListener('exit-vr', this.onSceneExitVr);
    this.controllerEls.forEach((controllerEl) => {
      controllerEl.addEventListener('selectend', this.onControllerRelease);
      controllerEl.addEventListener('triggerup', this.onControllerRelease);
      controllerEl.addEventListener('controllerdisconnected', this.onControllerDisconnected);
    });
  }

  tick(): void {
    if (!this.sceneEl.is('vr-mode')) return;

    if (this.activeControllerEl) {
      try {
        this.emit({ type: 'move', sourceId: this.activeControllerEl.id, ray: this.getControllerRay(this.activeControllerEl) });
      } catch {
        this.emit({ type: 'cancel', sourceId: this.activeControllerEl.id, reason: 'controller-ray-unavailable' });
        this.activeControllerEl = null;
      }
      return;
    }

    const hoverController = this.controllerEls.find((controllerEl) => {
      try {
        const ray = this.getControllerRay(controllerEl);
        controllerEl.components.raycaster?.raycaster.ray.copy(ray);
        return controllerEl.components.raycaster?.raycaster.intersectObject(this.opts.mugEl.object3D, true).length;
      } catch {
        return false;
      }
    });
    if (!hoverController) return;
    this.emit({ type: 'hover', sourceId: hoverController.id, ray: this.getControllerRay(hoverController) });
  }

  dispose(): void {
    this.opts.mugEl.removeEventListener('mousedown', this.onMugCursorMouseDown);
    this.opts.mugEl.removeEventListener('mouseup', this.onMugCursorMouseUp);
    this.opts.sceneEl.removeEventListener('exit-vr', this.onSceneExitVr);
    this.controllerEls.forEach((controllerEl) => {
      controllerEl.removeEventListener('selectend', this.onControllerRelease);
      controllerEl.removeEventListener('triggerup', this.onControllerRelease);
      controllerEl.removeEventListener('controllerdisconnected', this.onControllerDisconnected);
    });
  }

  refreshRaycasters(): void {
    this.controllerEls.forEach((controllerEl) => {
      controllerEl.components.raycaster?.refreshObjects?.();
    });
  }

  private get sceneEl(): SceneEl {
    return this.opts.sceneEl;
  }

  private emit(event: DragInputEvent): void {
    this.opts.emit(event);
  }

  private getCursorController(evt: Event): ControllerEl | null {
    const { cursorEl } = (evt as CustomEvent<CursorEventDetail>).detail ?? {};
    return this.controllerEls.find((controllerEl) => controllerEl === cursorEl) ?? null;
  }

  private end(controllerEl: ControllerEl): void {
    if (this.activeControllerEl !== controllerEl) return;
    try {
      this.emit({ type: 'end', sourceId: controllerEl.id, ray: this.getControllerRay(controllerEl) });
    } catch {
      this.emit({ type: 'cancel', sourceId: controllerEl.id, reason: 'controller-ray-unavailable-on-release' });
    }
    this.activeControllerEl = null;
  }

  private getControllerRay(controllerEl: ControllerEl): THREE.Ray {
    const raycasterComponent = controllerEl.components.raycaster;
    if (!raycasterComponent) {
      throw new Error(`Controller "${controllerEl.id}" is missing the raycaster component.`);
    }

    raycasterComponent.updateOriginDirection();
    return raycasterComponent.raycaster.ray.clone();
  }
}
