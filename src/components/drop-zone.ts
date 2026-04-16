import * as THREE from 'three';
import type { ZoneId } from '../types.ts';

interface DragDetail {
  position: THREE.Vector3;
  el: Element;
}

export function registerDropZone(): void {
  if (AFRAME.components['drop-zone']) return;

  AFRAME.registerComponent('drop-zone', {
    schema: {
      label: { type: 'string' },
      radius: { type: 'number', default: 0.7 },
    },

    ring: null as Element | null,

    init(this: {
      el: Element & { object3D: THREE.Object3D; sceneEl: { addEventListener: (e: string, cb: (evt: CustomEvent) => void) => void; emit: (name: string, detail?: unknown) => void } };
      data: { label: ZoneId; radius: number };
      ring: Element | null;
      _onDragMove: (evt: CustomEvent<DragDetail>) => void;
      _onDragEnd: (evt: CustomEvent<DragDetail>) => void;
    }) {
      // Create the ring indicator as a child entity
      const ring = document.createElement('a-torus');
      ring.setAttribute('radius', String(this.data.radius * 0.9));
      ring.setAttribute('radius-tubular', '0.03');
      ring.setAttribute('rotation', '-90 0 0');
      ring.setAttribute('material', 'color: #ffffff; opacity: 0.25; transparent: true; shader: flat');
      this.el.appendChild(ring);
      this.ring = ring;

      this._onDragMove = this._onDragMove.bind(this);
      this._onDragEnd = this._onDragEnd.bind(this);

      this.el.sceneEl.addEventListener('drag-move', this._onDragMove);
      this.el.sceneEl.addEventListener('drag-end', this._onDragEnd);
    },

    remove(this: {
      el: { sceneEl: { removeEventListener: (e: string, cb: (evt: CustomEvent) => void) => void } };
      _onDragMove: (evt: CustomEvent<DragDetail>) => void;
      _onDragEnd: (evt: CustomEvent<DragDetail>) => void;
    }) {
      this.el.sceneEl.removeEventListener('drag-move', this._onDragMove);
      this.el.sceneEl.removeEventListener('drag-end', this._onDragEnd);
    },

    _onDragMove(this: {
      el: { object3D: THREE.Object3D };
      data: { radius: number };
      ring: Element | null;
    }, evt: CustomEvent<DragDetail>) {
      const pos = evt.detail.position;
      const zoneWorld = new THREE.Vector3();
      this.el.object3D.getWorldPosition(zoneWorld);
      const dxz = Math.sqrt((pos.x - zoneWorld.x) ** 2 + (pos.z - zoneWorld.z) ** 2);
      const near = dxz < this.data.radius * 1.4;
      if (this.ring) {
        this.ring.setAttribute('material', `color: ${near ? '#ffdd00' : '#ffffff'}; opacity: ${near ? 0.7 : 0.25}; transparent: true; shader: flat`);
      }
    },

    _onDragEnd(this: {
      el: { object3D: THREE.Object3D; sceneEl: { emit: (name: string, detail?: unknown) => void } };
      data: { label: ZoneId; radius: number };
      ring: Element | null;
    }, evt: CustomEvent<DragDetail>) {
      // Reset highlight
      if (this.ring) {
        this.ring.setAttribute('material', 'color: #ffffff; opacity: 0.25; transparent: true; shader: flat');
      }

      const pos = evt.detail.position;
      const zoneWorld = new THREE.Vector3();
      this.el.object3D.getWorldPosition(zoneWorld);
      const dxz = Math.sqrt((pos.x - zoneWorld.x) ** 2 + (pos.z - zoneWorld.z) ** 2);

      if (dxz < this.data.radius) {
        this.el.sceneEl.emit('zone-drop', { zoneId: this.data.label, el: evt.detail.el });
      }
    },
  });
}
