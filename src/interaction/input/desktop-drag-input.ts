import * as THREE from 'three';
import type { DragInputAdapter, DragInputEvent, SceneEl } from '../types.ts';

function getMouseNDC(evt: MouseEvent, canvas: HTMLCanvasElement): THREE.Vector2 {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((evt.clientX - rect.left) / rect.width) * 2 - 1,
    -((evt.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

export class DesktopDragInput implements DragInputAdapter {
  private readonly raycaster = new THREE.Raycaster();
  private isActive = false;
  private readonly opts: {
    sceneEl: SceneEl;
    emit: (event: DragInputEvent) => void;
  };

  private readonly onCanvasMouseDown = (evt: MouseEvent) => {
    if (this.sceneEl.is('vr-mode')) return;
    this.emit({ type: 'start', sourceId: 'mouse', ray: this.getMouseRay(evt) });
    this.isActive = true;
  };

  private readonly onWindowMouseMove = (evt: MouseEvent) => {
    if (this.sceneEl.is('vr-mode')) return;
    const ray = this.getMouseRay(evt);
    this.emit(this.isActive
      ? { type: 'move', sourceId: 'mouse', ray }
      : { type: 'hover', sourceId: 'mouse', ray });
  };

  private readonly onWindowMouseUp = (evt: MouseEvent) => {
    if (!this.isActive) return;
    this.isActive = false;
    this.emit({ type: 'end', sourceId: 'mouse', ray: this.getMouseRay(evt) });
  };

  constructor(opts: {
    sceneEl: SceneEl;
    emit: (event: DragInputEvent) => void;
  }) {
    this.opts = opts;
    this.opts.sceneEl.canvas.addEventListener('mousedown', this.onCanvasMouseDown);
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
  }

  dispose(): void {
    this.opts.sceneEl.canvas.removeEventListener('mousedown', this.onCanvasMouseDown);
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
  }

  private get sceneEl(): SceneEl {
    return this.opts.sceneEl;
  }

  private emit(event: DragInputEvent): void {
    this.opts.emit(event);
  }

  private getMouseRay(evt: MouseEvent): THREE.Ray {
    const mouse = getMouseNDC(evt, this.sceneEl.canvas);
    this.raycaster.setFromCamera(mouse, this.sceneEl.camera);
    return this.raycaster.ray.clone();
  }
}
