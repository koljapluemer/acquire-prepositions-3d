import * as THREE from 'three';

const MUG_HOVER_OFFSET = 0.18; // metres above zone surface when snapped

interface SceneEl extends Element {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  emit(name: string, detail?: unknown): void;
}

interface DraggableEl extends Element {
  object3D: THREE.Object3D;
  sceneEl: SceneEl;
}

interface DropZoneEl extends Element {
  object3D: THREE.Object3D;
}

interface DropZoneComponent {
  hitMesh: THREE.Mesh;
  setHighlight(active: boolean): void;
}

interface DraggableInstance {
  el: DraggableEl;
  isDragging: boolean;
  originPosition: THREE.Vector3;
  dragDepth: number;
  hoveredZone: Element | null;
  raycaster: THREE.Raycaster;
  _onCanvasMouseDown: (e: MouseEvent) => void;
  _onWindowMouseMove: (e: MouseEvent) => void;
  _onWindowMouseUp: () => void;
}

function getMouseNDC(evt: MouseEvent, canvas: HTMLCanvasElement): THREE.Vector2 {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((evt.clientX - rect.left) / rect.width) * 2 - 1,
    -((evt.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

function getDropZones(): { el: DropZoneEl; component: DropZoneComponent }[] {
  return Array.from(document.querySelectorAll('[drop-zone]')).map((el) => ({
    el: el as DropZoneEl,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: (el as any).components['drop-zone'] as DropZoneComponent,
  }));
}

export function registerDraggable(): void {
  if (AFRAME.components['draggable']) return;

  AFRAME.registerComponent('draggable', {
    isDragging: false,
    originPosition: null as unknown as THREE.Vector3,
    dragDepth: 0,
    hoveredZone: null as Element | null,
    raycaster: null as unknown as THREE.Raycaster,

    init(this: DraggableInstance) {
      this.isDragging = false;
      this.originPosition = new THREE.Vector3();
      this.dragDepth = 0;
      this.hoveredZone = null;
      this.raycaster = new THREE.Raycaster();

      this._onCanvasMouseDown = this._onCanvasMouseDown.bind(this);
      this._onWindowMouseMove = this._onWindowMouseMove.bind(this);
      this._onWindowMouseUp = this._onWindowMouseUp.bind(this);

      this.el.sceneEl.canvas.addEventListener('mousedown', this._onCanvasMouseDown);
      window.addEventListener('mousemove', this._onWindowMouseMove);
      window.addEventListener('mouseup', this._onWindowMouseUp);
    },

    remove(this: DraggableInstance) {
      this.el.sceneEl.canvas.removeEventListener('mousedown', this._onCanvasMouseDown);
      window.removeEventListener('mousemove', this._onWindowMouseMove);
      window.removeEventListener('mouseup', this._onWindowMouseUp);
    },

    _onCanvasMouseDown(this: DraggableInstance, evt: MouseEvent) {
      const mouse = getMouseNDC(evt, this.el.sceneEl.canvas);
      this.raycaster.setFromCamera(mouse, this.el.sceneEl.camera);
      if (this.raycaster.intersectObject(this.el.object3D, true).length === 0) return;

      const worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);
      this.originPosition.copy(worldPos);

      const camPos = new THREE.Vector3();
      this.el.sceneEl.camera.getWorldPosition(camPos);
      this.dragDepth = camPos.distanceTo(worldPos);

      this.isDragging = true;
      this.el.sceneEl.canvas.style.cursor = 'grabbing';
    },

    _onWindowMouseMove(this: DraggableInstance, evt: MouseEvent) {
      if (!this.isDragging) return;

      const mouse = getMouseNDC(evt, this.el.sceneEl.canvas);
      this.raycaster.setFromCamera(mouse, this.el.sceneEl.camera);

      const zones = getDropZones();
      const hitMeshes = zones.map((z) => z.component.hitMesh).filter(Boolean);
      const hits = this.raycaster.intersectObjects(hitMeshes, false);

      let newHovered: Element | null = null;

      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        const zone = zones.find((z) => z.component.hitMesh === hitMesh)!;
        newHovered = zone.el;

        const zoneWorld = new THREE.Vector3();
        zone.el.object3D.getWorldPosition(zoneWorld);
        this.el.object3D.position.set(zoneWorld.x, zoneWorld.y + MUG_HOVER_OFFSET, zoneWorld.z);
      } else {
        // Move along ray at pickup depth — no depth-of-space awkwardness
        const target = new THREE.Vector3();
        this.raycaster.ray.at(this.dragDepth, target);
        this.el.object3D.position.copy(target);
      }

      // Update highlights
      if (newHovered !== this.hoveredZone) {
        if (this.hoveredZone) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this.hoveredZone as any).components['drop-zone'].setHighlight(false);
        }
        if (newHovered) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (newHovered as any).components['drop-zone'].setHighlight(true);
        }
        this.hoveredZone = newHovered;
      }
    },

    _onWindowMouseUp(this: DraggableInstance) {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.el.sceneEl.canvas.style.cursor = 'default';
      this.el.sceneEl.emit('drag-end', { el: this.el, hoveredZoneEl: this.hoveredZone });
      this.hoveredZone = null;
    },

    snapBack(this: DraggableInstance) {
      const target = this.originPosition.clone();
      const startPos = this.el.object3D.position.clone();
      const duration = 300;
      const startTime = performance.now();

      const animate = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        this.el.object3D.position.lerpVectors(startPos, target, eased);
        if (t < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    },
  });
}
