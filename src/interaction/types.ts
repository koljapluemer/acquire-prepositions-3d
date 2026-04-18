import type * as THREE from 'three';

export type DragInputEvent =
  | { type: 'start'; sourceId: string; ray: THREE.Ray }
  | { type: 'move'; sourceId: string; ray: THREE.Ray }
  | { type: 'hover'; sourceId: string; ray: THREE.Ray }
  | { type: 'end'; sourceId: string; ray: THREE.Ray }
  | { type: 'cancel'; sourceId: string; reason: string };

export interface DragInputAdapter {
  dispose(): void;
  tick?(time: number): void;
}

export interface SceneEl extends Element {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  emit(name: string, detail?: unknown): void;
  is(name: string): boolean;
}

export interface MugEl extends Element {
  classList: DOMTokenList;
  object3D: THREE.Object3D;
  sceneEl: SceneEl;
}

export interface ControllerEl extends Element {
  id: string;
  object3D: THREE.Object3D;
  components: {
    raycaster?: {
      raycaster: THREE.Raycaster;
      refreshObjects?: () => void;
      updateOriginDirection: () => void;
    };
  };
}

export interface DropZoneEl extends Element {
  object3D: THREE.Object3D;
}

export interface DropZoneHandle {
  el: DropZoneEl;
  hitMesh: THREE.Mesh;
  setHighlight(active: boolean): void;
}
