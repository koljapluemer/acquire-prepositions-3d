import * as THREE from 'three';

const MUG_HOVER_OFFSET = 0.06; // metres above zone surface when snapped
const MUG_IDLE_BOB_HEIGHT = 0.012;
const MUG_IDLE_BOB_SPEED = 0.0018;
const MUG_DRAG_SCALE_FACTOR = 1.04;
const MUG_RESET_FADE_OUT_MS = 350;
const MUG_RESET_FADE_IN_MS = 250;
const GRABBABLE_CLASS = 'grabbable';

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

interface ControllerEl extends Element {
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
  isInteractionEnabled: boolean;
  activeSourceId: string | null;
  activeControllerEl: ControllerEl | null;
  controllerEls: ControllerEl[];
  originPosition: THREE.Vector3;
  startPosition: THREE.Vector3;
  idleBasePosition: THREE.Vector3;
  idleScale: THREE.Vector3;
  dragDepth: number;
  hoveredZone: Element | null;
  raycaster: THREE.Raycaster;
  _onCanvasMouseDown: (e: MouseEvent) => void;
  _onWindowMouseMove: (e: MouseEvent) => void;
  _onWindowMouseUp: () => void;
  _onMugCursorMouseDown: (e: Event) => void;
  _onMugCursorMouseUp: (e: Event) => void;
  _onControllerRelease: (e: Event) => void;
  _onControllerDisconnected: (e: Event) => void;
  _onSceneExitVr: () => void;
  getMouseRay: (evt: MouseEvent) => THREE.Ray;
  getControllerRay: (controllerEl: ControllerEl) => THREE.Ray;
  tryBeginDrag: (ray: THREE.Ray, sourceId: string) => boolean;
  updateDragFromRay: (ray: THREE.Ray) => void;
  endDrag: (sourceId: string) => void;
  cancelDrag: () => void;
  updatePointerHoverFromRay: (ray: THREE.Ray) => void;
  setHoveredZone: (zone: Element | null) => void;
  setCanvasCursor: (cursor: string) => void;
  resetToStartWithFade: (onComplete?: () => void) => void;
  setInteractionEnabled(enabled: boolean): void;
  setInteractiveVisual(active: boolean): void;
  setRaycastable(active: boolean): void;
  syncRaycastable: () => void;
}

interface MaterialState {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

interface CursorEventDetail {
  cursorEl?: Element;
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
    isInteractionEnabled: true,
    activeSourceId: null as string | null,
    activeControllerEl: null as ControllerEl | null,
    controllerEls: [] as ControllerEl[],
    originPosition: null as unknown as THREE.Vector3,
    startPosition: null as unknown as THREE.Vector3,
    idleBasePosition: null as unknown as THREE.Vector3,
    idleScale: null as unknown as THREE.Vector3,
    dragDepth: 0,
    hoveredZone: null as Element | null,
    raycaster: null as unknown as THREE.Raycaster,

    init(this: DraggableInstance) {
      this.isDragging = false;
      this.isPointerOver = false;
      this.isSnapping = false;
      this.isResetting = false;
      this.isInteractionEnabled = true;
      this.activeSourceId = null;
      this.activeControllerEl = null;
      this.controllerEls = Array.from(document.querySelectorAll('#left-controller, #right-controller')) as ControllerEl[];
      this.originPosition = new THREE.Vector3();
      this.startPosition = this.el.object3D.position.clone();
      this.idleBasePosition = this.el.object3D.position.clone();
      this.idleScale = this.el.object3D.scale.clone();
      this.dragDepth = 0;
      this.hoveredZone = null;
      this.raycaster = new THREE.Raycaster();

      this._onCanvasMouseDown = this._onCanvasMouseDown.bind(this);
      this._onWindowMouseMove = this._onWindowMouseMove.bind(this);
      this._onWindowMouseUp = this._onWindowMouseUp.bind(this);
      this._onMugCursorMouseDown = this._onMugCursorMouseDown.bind(this);
      this._onMugCursorMouseUp = this._onMugCursorMouseUp.bind(this);
      this._onControllerRelease = this._onControllerRelease.bind(this);
      this._onControllerDisconnected = this._onControllerDisconnected.bind(this);
      this._onSceneExitVr = this._onSceneExitVr.bind(this);

      this.el.sceneEl.canvas.addEventListener('mousedown', this._onCanvasMouseDown);
      window.addEventListener('mousemove', this._onWindowMouseMove);
      window.addEventListener('mouseup', this._onWindowMouseUp);
      this.el.addEventListener('mousedown', this._onMugCursorMouseDown);
      this.el.addEventListener('mouseup', this._onMugCursorMouseUp);
      this.el.sceneEl.addEventListener('exit-vr', this._onSceneExitVr);
      this.controllerEls.forEach((controllerEl) => {
        controllerEl.addEventListener('selectend', this._onControllerRelease);
        controllerEl.addEventListener('triggerup', this._onControllerRelease);
        controllerEl.addEventListener('controllerdisconnected', this._onControllerDisconnected);
      });
    },

    remove(this: DraggableInstance) {
      this.el.sceneEl.canvas.removeEventListener('mousedown', this._onCanvasMouseDown);
      window.removeEventListener('mousemove', this._onWindowMouseMove);
      window.removeEventListener('mouseup', this._onWindowMouseUp);
      this.el.removeEventListener('mousedown', this._onMugCursorMouseDown);
      this.el.removeEventListener('mouseup', this._onMugCursorMouseUp);
      this.el.sceneEl.removeEventListener('exit-vr', this._onSceneExitVr);
      this.controllerEls.forEach((controllerEl) => {
        controllerEl.removeEventListener('selectend', this._onControllerRelease);
        controllerEl.removeEventListener('triggerup', this._onControllerRelease);
        controllerEl.removeEventListener('controllerdisconnected', this._onControllerDisconnected);
      });
    },

    _onCanvasMouseDown(this: DraggableInstance, evt: MouseEvent) {
      if (!this.isInteractionEnabled) return;
      if (this.isResetting) return;
      if (this.el.sceneEl.is('vr-mode')) return;
      this.tryBeginDrag(this.getMouseRay(evt), 'mouse');
    },

    _onWindowMouseMove(this: DraggableInstance, evt: MouseEvent) {
      if (!this.isInteractionEnabled) return;
      if (isSceneUIOpen(this.el.sceneEl)) return;
      if (this.isResetting) return;
      if (this.el.sceneEl.is('vr-mode')) return;
      const ray = this.getMouseRay(evt);

      if (this.isDragging && this.activeSourceId === 'mouse') {
        this.updateDragFromRay(ray);
        return;
      }

      this.updatePointerHoverFromRay(ray);
    },

    _onWindowMouseUp(this: DraggableInstance) {
      this.endDrag('mouse');
    },

    _onMugCursorMouseDown(this: DraggableInstance, evt: Event) {
      if (!this.isInteractionEnabled) return;
      if (this.isResetting) return;
      if (!this.el.sceneEl.is('vr-mode')) return;
      const { cursorEl } = (evt as CustomEvent<CursorEventDetail>).detail ?? {};
      const controllerEl = this.controllerEls.find((el) => el === cursorEl);
      if (!controllerEl) return;
      const sourceId = controllerEl.id;
      if (this.tryBeginDrag(this.getControllerRay(controllerEl), sourceId)) {
        this.activeControllerEl = controllerEl;
      }
    },

    _onMugCursorMouseUp(this: DraggableInstance, evt: Event) {
      if (!this.el.sceneEl.is('vr-mode')) return;
      const { cursorEl } = (evt as CustomEvent<CursorEventDetail>).detail ?? {};
      const controllerEl = this.controllerEls.find((el) => el === cursorEl);
      if (!controllerEl) return;
      if (this.isDragging && this.activeSourceId === controllerEl.id) {
        this.updateDragFromRay(this.getControllerRay(controllerEl));
      }
      this.endDrag(controllerEl.id);
    },

    _onControllerRelease(this: DraggableInstance, evt: Event) {
      const controllerEl = evt.currentTarget as ControllerEl | null;
      if (!controllerEl) return;
      if (this.isDragging && this.activeSourceId === controllerEl.id) {
        try {
          this.updateDragFromRay(this.getControllerRay(controllerEl));
        } catch (error) {
          console.warn('Cancelling mug drag after final controller ray update failed.', error);
          this.cancelDrag();
          return;
        }
      }
      this.endDrag(controllerEl.id);
    },

    _onControllerDisconnected(this: DraggableInstance, evt: Event) {
      if (evt.currentTarget === this.activeControllerEl) this.cancelDrag();
    },

    _onSceneExitVr(this: DraggableInstance) {
      if (this.activeSourceId !== 'mouse') this.cancelDrag();
    },

    getMouseRay(this: DraggableInstance, evt: MouseEvent): THREE.Ray {
      const mouse = getMouseNDC(evt, this.el.sceneEl.canvas);
      this.raycaster.setFromCamera(mouse, this.el.sceneEl.camera);
      return this.raycaster.ray.clone();
    },

    getControllerRay(this: DraggableInstance, controllerEl: ControllerEl): THREE.Ray {
      const raycasterComponent = controllerEl.components.raycaster;
      if (!raycasterComponent) {
        throw new Error(`Controller "${controllerEl.id}" is missing the raycaster component.`);
      }

      raycasterComponent.updateOriginDirection();
      return raycasterComponent.raycaster.ray.clone();
    },

    tryBeginDrag(this: DraggableInstance, ray: THREE.Ray, sourceId: string): boolean {
      if (!this.isInteractionEnabled || this.isDragging || this.isSnapping || this.isResetting || isSceneUIOpen(this.el.sceneEl)) {
        return false;
      }
      this.raycaster.ray.copy(ray);
      if (this.raycaster.intersectObjects(getUIButtons().map((el) => el.object3D), true).length > 0) {
        return false;
      }
      if (this.raycaster.intersectObject(this.el.object3D, true).length === 0) return false;

      this.el.object3D.position.copy(this.idleBasePosition);
      const worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);
      this.originPosition.copy(worldPos);

      const pickupOffset = worldPos.clone().sub(ray.origin);
      this.dragDepth = Math.max(0.1, pickupOffset.dot(ray.direction));

      this.isDragging = true;
      this.activeSourceId = sourceId;
      this.setInteractiveVisual(true);
      this.syncRaycastable();
      this.setCanvasCursor('grabbing');
      return true;
    },

    updateDragFromRay(this: DraggableInstance, ray: THREE.Ray) {
      this.raycaster.ray.copy(ray);
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
        ray.at(this.dragDepth, target);
        this.el.object3D.position.copy(target);
      }

      this.setHoveredZone(newHovered);
    },

    endDrag(this: DraggableInstance, sourceId: string) {
      if (!this.isDragging) return;
      if (this.activeSourceId !== sourceId) return;
      const droppedZone = this.hoveredZone;
      this.isDragging = false;
      this.activeSourceId = null;
      this.activeControllerEl = null;
      this.setInteractiveVisual(false);
      this.syncRaycastable();
      this.setCanvasCursor(this.isPointerOver ? 'grab' : 'default');
      if (droppedZone) this.idleBasePosition.copy(this.el.object3D.position);
      this.el.sceneEl.emit('drag-end', { el: this.el, hoveredZoneEl: droppedZone });
      if (this.hoveredZone === droppedZone) this.setHoveredZone(null);
    },

    cancelDrag(this: DraggableInstance) {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.activeSourceId = null;
      this.activeControllerEl = null;
      this.el.object3D.position.copy(this.originPosition);
      this.idleBasePosition.copy(this.originPosition);
      this.setInteractiveVisual(false);
      this.syncRaycastable();
      this.setHoveredZone(null);
      this.setCanvasCursor('default');
    },

    updatePointerHoverFromRay(this: DraggableInstance, ray: THREE.Ray) {
      this.raycaster.ray.copy(ray);
      if (this.raycaster.intersectObjects(getUIButtons().map((el) => el.object3D), true).length > 0) {
        if (this.isPointerOver) {
          this.isPointerOver = false;
          this.setInteractiveVisual(false);
        }
        this.setCanvasCursor('default');
        return;
      }
      const isPointerOver = this.raycaster.intersectObject(this.el.object3D, true).length > 0;
      if (isPointerOver !== this.isPointerOver) {
        this.isPointerOver = isPointerOver;
        this.setInteractiveVisual(isPointerOver);
        this.setCanvasCursor(isPointerOver ? 'grab' : 'default');
      }
    },

    setHoveredZone(this: DraggableInstance, zone: Element | null) {
      if (zone === this.hoveredZone) return;
      if (this.hoveredZone) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.hoveredZone as any).components['drop-zone'].setHighlight(false);
      }
      if (zone) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (zone as any).components['drop-zone'].setHighlight(true);
      }
      this.hoveredZone = zone;
    },

    setCanvasCursor(this: DraggableInstance, cursor: string) {
      if (this.el.sceneEl.is('vr-mode')) return;
      this.el.sceneEl.canvas.style.cursor = cursor;
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
          this.syncRaycastable();
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
      this.activeSourceId = null;
      this.activeControllerEl = null;
      this.setHoveredZone(null);
      this.setInteractiveVisual(false);
      this.syncRaycastable();
      this.setCanvasCursor('default');

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
          this.syncRaycastable();
          onComplete?.();
        });
      });
    },

    setInteractionEnabled(this: DraggableInstance, enabled: boolean) {
      this.isInteractionEnabled = enabled;
      if (!enabled) {
        this.cancelDrag();
        this.isPointerOver = false;
        this.setInteractiveVisual(false);
        this.setHoveredZone(null);
        this.setCanvasCursor('default');
      }
      this.syncRaycastable();
    },

    setInteractiveVisual(this: DraggableInstance, active: boolean) {
      const factor = active ? MUG_DRAG_SCALE_FACTOR : 1;
      this.el.object3D.scale.copy(this.idleScale).multiplyScalar(factor);
    },

    setRaycastable(this: DraggableInstance, active: boolean) {
      this.el.classList.toggle(GRABBABLE_CLASS, active);
      this.controllerEls.forEach((controllerEl) => {
        controllerEl.components.raycaster?.refreshObjects?.();
      });
    },

    syncRaycastable(this: DraggableInstance) {
      this.setRaycastable(this.isInteractionEnabled && !this.isDragging && !this.isSnapping && !this.isResetting);
    },

    tick(this: DraggableInstance, time: number) {
      if (this.isDragging) {
        if (this.activeControllerEl) {
          try {
            this.updateDragFromRay(this.getControllerRay(this.activeControllerEl));
          } catch (error) {
            console.warn('Cancelling mug drag after controller ray update failed.', error);
            this.cancelDrag();
          }
        }
        return;
      }
      if (this.isSnapping || this.isResetting) return;

      const bob = Math.sin(time * MUG_IDLE_BOB_SPEED) * MUG_IDLE_BOB_HEIGHT;
      this.el.object3D.position.set(
        this.idleBasePosition.x,
        this.idleBasePosition.y + bob,
        this.idleBasePosition.z,
      );

      if (this.isInteractionEnabled && this.el.sceneEl.is('vr-mode')) {
        const controllerEl = this.controllerEls.find((el) => {
          const ray = this.getControllerRay(el);
          this.raycaster.ray.copy(ray);
          return this.raycaster.intersectObject(this.el.object3D, true).length > 0;
        });
        if (controllerEl) {
          this.updatePointerHoverFromRay(this.getControllerRay(controllerEl));
        } else if (this.isPointerOver) {
          this.isPointerOver = false;
          this.setInteractiveVisual(false);
        }
      }
    },
  });
}
