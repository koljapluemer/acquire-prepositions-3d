import * as THREE from 'three';

const MUG_HOVER_OFFSET = 0.18; // metres above zone surface when snapped
const MUG_IDLE_BOB_HEIGHT = 0.035;
const MUG_IDLE_BOB_SPEED = 0.0018;
const MUG_IDLE_SCALE = 1;
const MUG_DRAG_SCALE = 1.04;
const MUG_RESET_FADE_OUT_MS = 350;
const MUG_RESET_FADE_IN_MS = 250;

interface SceneEl extends Element {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  emit(name: string, detail?: unknown): void;
  is(name: string): boolean;
}

interface DraggableEl extends Element {
  object3D: THREE.Object3D;
  sceneEl: SceneEl;
}

interface DropZoneEl extends Element {
  object3D: THREE.Object3D;
}

interface UIEl extends Element {
  object3D: THREE.Object3D;
}

interface DropZoneComponent {
  hitMesh: THREE.Mesh;
  isUnlocked: boolean;
  setHighlight(active: boolean): void;
}

interface DraggableInstance {
  el: DraggableEl;
  isDragging: boolean;
  isPointerOver: boolean;
  isSnapping: boolean;
  isResetting: boolean;
  originPosition: THREE.Vector3;
  startPosition: THREE.Vector3;
  idleBasePosition: THREE.Vector3;
  dragDepth: number;
  hoveredZone: Element | null;
  raycaster: THREE.Raycaster;
  _onCanvasMouseDown: (e: MouseEvent) => void;
  _onWindowMouseMove: (e: MouseEvent) => void;
  _onWindowMouseUp: () => void;
  resetToStartWithFade: (onComplete?: () => void) => void;
  setInteractiveVisual(active: boolean): void;
}

interface MaterialState {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

function getMouseNDC(evt: MouseEvent, canvas: HTMLCanvasElement): THREE.Vector2 {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((evt.clientX - rect.left) / rect.width) * 2 - 1,
    -((evt.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

function isSceneUIOpen(sceneEl: SceneEl): boolean {
  return sceneEl.is('ui-open');
}

function isVisibleInScene(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function getUIButtons(): UIEl[] {
  return Array.from(document.querySelectorAll('.ui-interactable'))
    .map((el) => el as UIEl)
    .filter((el) => isVisibleInScene(el.object3D));
}

function getDropZones(): { el: DropZoneEl; component: DropZoneComponent }[] {
  return Array.from(document.querySelectorAll('[drop-zone]')).map((el) => ({
    el: el as DropZoneEl,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: (el as any).components['drop-zone'] as DropZoneComponent,
  })).filter((zone) => zone.component.isUnlocked);
}

function getMeshMaterials(root: THREE.Object3D): THREE.Material[] {
  const materials: THREE.Material[] = [];

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const material = mesh.material;
    if (!material) return;
    if (Array.isArray(material)) {
      materials.push(...material);
    } else {
      materials.push(material);
    }
  });

  return [...new Set(materials)];
}

function fadeMaterials(
  states: MaterialState[],
  fromFactor: number,
  toFactor: number,
  duration: number,
  onComplete: () => void,
): void {
  const startTime = performance.now();

  const animate = (now: number) => {
    const t = Math.min((now - startTime) / duration, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const opacityFactor = THREE.MathUtils.lerp(fromFactor, toFactor, eased);
    states.forEach(({ material, opacity }) => {
      material.opacity = opacity * opacityFactor;
      material.needsUpdate = true;
    });

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      onComplete();
    }
  };

  requestAnimationFrame(animate);
}

export function registerDraggable(): void {
  if (AFRAME.components['draggable']) return;

  AFRAME.registerComponent('draggable', {
    isDragging: false,
    isPointerOver: false,
    isSnapping: false,
    isResetting: false,
    originPosition: null as unknown as THREE.Vector3,
    startPosition: null as unknown as THREE.Vector3,
    idleBasePosition: null as unknown as THREE.Vector3,
    dragDepth: 0,
    hoveredZone: null as Element | null,
    raycaster: null as unknown as THREE.Raycaster,

    init(this: DraggableInstance) {
      this.isDragging = false;
      this.isPointerOver = false;
      this.isSnapping = false;
      this.isResetting = false;
      this.originPosition = new THREE.Vector3();
      this.startPosition = this.el.object3D.position.clone();
      this.idleBasePosition = this.el.object3D.position.clone();
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
      if (this.isResetting) return;
      const mouse = getMouseNDC(evt, this.el.sceneEl.canvas);
      this.raycaster.setFromCamera(mouse, this.el.sceneEl.camera);
      if (isSceneUIOpen(this.el.sceneEl) || this.raycaster.intersectObjects(getUIButtons().map((el) => el.object3D), true).length > 0) {
        return;
      }
      if (this.raycaster.intersectObject(this.el.object3D, true).length === 0) return;

      this.el.object3D.position.copy(this.idleBasePosition);
      const worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);
      this.originPosition.copy(worldPos);

      const camPos = new THREE.Vector3();
      this.el.sceneEl.camera.getWorldPosition(camPos);
      this.dragDepth = camPos.distanceTo(worldPos);

      this.isDragging = true;
      this.setInteractiveVisual(true);
      this.el.sceneEl.canvas.style.cursor = 'grabbing';
    },

    _onWindowMouseMove(this: DraggableInstance, evt: MouseEvent) {
      if (isSceneUIOpen(this.el.sceneEl)) return;
      if (this.isResetting) return;
      const mouse = getMouseNDC(evt, this.el.sceneEl.canvas);
      this.raycaster.setFromCamera(mouse, this.el.sceneEl.camera);

      if (!this.isDragging) {
        if (this.raycaster.intersectObjects(getUIButtons().map((el) => el.object3D), true).length > 0) {
          if (this.isPointerOver) {
            this.isPointerOver = false;
            this.setInteractiveVisual(false);
          }
          this.el.sceneEl.canvas.style.cursor = 'default';
          return;
        }
        const isPointerOver = this.raycaster.intersectObject(this.el.object3D, true).length > 0;
        if (isPointerOver !== this.isPointerOver) {
          this.isPointerOver = isPointerOver;
          this.setInteractiveVisual(isPointerOver);
          this.el.sceneEl.canvas.style.cursor = isPointerOver ? 'grab' : 'default';
        }
        return;
      }

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
      this.setInteractiveVisual(false);
      this.el.sceneEl.canvas.style.cursor = this.isPointerOver ? 'grab' : 'default';
      this.el.sceneEl.emit('drag-end', { el: this.el, hoveredZoneEl: this.hoveredZone });
      if (this.hoveredZone) this.idleBasePosition.copy(this.el.object3D.position);
      this.hoveredZone = null;
    },

    snapBack(this: DraggableInstance) {
      const target = this.originPosition.clone();
      const startPos = this.el.object3D.position.clone();
      const duration = 300;
      const startTime = performance.now();
      this.isSnapping = true;

      const animate = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        this.el.object3D.position.lerpVectors(startPos, target, eased);
        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          this.idleBasePosition.copy(target);
          this.isSnapping = false;
        }
      };
      requestAnimationFrame(animate);
    },

    resetToStartWithFade(this: DraggableInstance, onComplete?: () => void) {
      const materials = getMeshMaterials(this.el.object3D);
      if (materials.length === 0) {
        this.el.object3D.position.copy(this.startPosition);
        this.idleBasePosition.copy(this.startPosition);
        onComplete?.();
        return;
      }

      this.isResetting = true;
      this.isDragging = false;
      this.isPointerOver = false;
      this.setInteractiveVisual(false);
      this.el.sceneEl.canvas.style.cursor = 'default';

      const states: MaterialState[] = materials.map((material) => ({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
      }));

      states.forEach(({ material }) => {
        material.transparent = true;
        material.depthWrite = false;
        material.needsUpdate = true;
      });

      fadeMaterials(states, 1, 0, MUG_RESET_FADE_OUT_MS, () => {
        this.el.object3D.position.copy(this.startPosition);
        this.idleBasePosition.copy(this.startPosition);

        fadeMaterials(states, 0, 1, MUG_RESET_FADE_IN_MS, () => {
          states.forEach(({ material, opacity, transparent, depthWrite }) => {
            material.opacity = opacity;
            material.transparent = transparent;
            material.depthWrite = depthWrite;
            material.needsUpdate = true;
          });
          this.isResetting = false;
          onComplete?.();
        });
      });
    },

    setInteractiveVisual(this: DraggableInstance, active: boolean) {
      this.el.object3D.scale.setScalar(active ? MUG_DRAG_SCALE : MUG_IDLE_SCALE);
    },

    tick(this: DraggableInstance, time: number) {
      if (this.isDragging || this.isSnapping || this.isResetting) return;
      const bob = Math.sin(time * MUG_IDLE_BOB_SPEED) * MUG_IDLE_BOB_HEIGHT;
      this.el.object3D.position.set(
        this.idleBasePosition.x,
        this.idleBasePosition.y + bob,
        this.idleBasePosition.z,
      );
    },
  });
}
