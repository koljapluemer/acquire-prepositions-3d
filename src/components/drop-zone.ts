import * as THREE from 'three';
import type { ZoneId } from '../types.ts';

interface SceneEl extends Element {
  addEventListener(event: string, cb: (e: Event) => void): void;
  removeEventListener(event: string, cb: (e: Event) => void): void;
  emit(name: string, detail?: unknown): void;
}

interface DropZoneEl extends Element {
  object3D: THREE.Object3D;
  sceneEl: SceneEl;
}

interface DragEndDetail {
  el: Element;
  hoveredZoneEl: Element | null;
}

interface DropZoneInstance {
  el: DropZoneEl;
  data: { label: ZoneId; radius: number };
  ring: Element | null;
  hitMesh: THREE.Mesh;
  _onDragEnd: (e: Event) => void;
  setHighlight(active: boolean): void;
}

export function registerDropZone(): void {
  if (AFRAME.components['drop-zone']) return;

  AFRAME.registerComponent('drop-zone', {
    schema: {
      label: { type: 'string' },
      radius: { type: 'number', default: 0.7 },
    },

    ring: null as Element | null,
    hitMesh: null as unknown as THREE.Mesh,

    init(this: DropZoneInstance) {
      // Invisible hit disc for raycasting
      const geo = new THREE.CylinderGeometry(this.data.radius, this.data.radius, 0.05, 32);
      const mat = new THREE.MeshBasicMaterial({ visible: false });
      this.hitMesh = new THREE.Mesh(geo, mat);
      this.el.object3D.add(this.hitMesh);

      // Visible ring indicator
      const ring = document.createElement('a-torus');
      ring.setAttribute('radius', String(this.data.radius * 0.85));
      ring.setAttribute('radius-tubular', '0.03');
      ring.setAttribute('rotation', '-90 0 0');
      ring.setAttribute('material', 'color: #00cfff; opacity: 0.7; transparent: true; shader: flat');
      this.el.appendChild(ring);
      this.ring = ring;

      this._onDragEnd = this._onDragEnd.bind(this);
      this.el.sceneEl.addEventListener('drag-end', this._onDragEnd);
    },

    remove(this: DropZoneInstance) {
      this.el.sceneEl.removeEventListener('drag-end', this._onDragEnd);
    },

    setHighlight(this: DropZoneInstance, active: boolean) {
      if (!this.ring) return;
      this.ring.setAttribute(
        'material',
        `color: ${active ? '#ffdd00' : '#00cfff'}; opacity: ${active ? 0.9 : 0.7}; transparent: true; shader: flat`,
      );
    },

    _onDragEnd(this: DropZoneInstance, e: Event) {
      const { hoveredZoneEl, el } = (e as CustomEvent<DragEndDetail>).detail;
      this.setHighlight(false);
      if (hoveredZoneEl === this.el) {
        this.el.sceneEl.emit('zone-drop', { zoneId: this.data.label, el });
      }
    },
  });
}
