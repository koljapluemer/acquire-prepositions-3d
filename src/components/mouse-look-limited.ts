import * as THREE from 'three';

interface MouseLookLimitedData {
  maxX: number;
  maxY: number;
}

interface MouseLookLimitedEl extends Element {
  object3D: THREE.Object3D;
  sceneEl: {
    canvas: HTMLCanvasElement;
  };
}

interface MouseLookLimitedInstance {
  el: MouseLookLimitedEl;
  data: MouseLookLimitedData;
  startPosition: THREE.Vector3;
  startRotation: { x: number; y: number; z: number };
  _onMouseMove: (evt: MouseEvent) => void;
}

function getElementRotation(el: Element): { x: number; y: number; z: number } {
  const rotation = el.getAttribute('rotation') as { x: number; y: number; z: number } | null;
  return {
    x: rotation?.x ?? 0,
    y: rotation?.y ?? 0,
    z: rotation?.z ?? 0,
  };
}

export function registerMouseLookLimited(): void {
  if (AFRAME.components['mouse-look-limited']) return;

  AFRAME.registerComponent('mouse-look-limited', {
    schema: {
      maxX: { type: 'number', default: 30 },
      maxY: { type: 'number', default: 60 },
    },

    startPosition: null as unknown as THREE.Vector3,
    startRotation: null as unknown as { x: number; y: number; z: number },

    init(this: MouseLookLimitedInstance) {
      this.startPosition = this.el.object3D.position.clone();
      this.startRotation = getElementRotation(this.el);
      this._onMouseMove = this._onMouseMove.bind(this);
      this.el.sceneEl.canvas.addEventListener('mousemove', this._onMouseMove);
    },

    remove(this: MouseLookLimitedInstance) {
      this.el.sceneEl.canvas.removeEventListener('mousemove', this._onMouseMove);
    },

    _onMouseMove(this: MouseLookLimitedInstance, evt: MouseEvent) {
      const rect = this.el.sceneEl.canvas.getBoundingClientRect();
      const normalizedX = THREE.MathUtils.clamp(((evt.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      const normalizedY = THREE.MathUtils.clamp(((evt.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);

      this.el.object3D.rotation.set(
        THREE.MathUtils.degToRad(this.startRotation.x - normalizedY * this.data.maxX),
        THREE.MathUtils.degToRad(this.startRotation.y - normalizedX * this.data.maxY),
        THREE.MathUtils.degToRad(this.startRotation.z),
      );
    },

    tick(this: MouseLookLimitedInstance) {
      this.el.object3D.position.copy(this.startPosition);
      this.el.object3D.rotation.z = THREE.MathUtils.degToRad(this.startRotation.z);
    },
  });
}
