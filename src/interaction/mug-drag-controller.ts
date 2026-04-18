import * as THREE from 'three';
import type { DragInputEvent, DropZoneHandle, MugEl, SceneEl } from './types.ts';

const MUG_HOVER_OFFSET = 0.06;
const MUG_IDLE_BOB_HEIGHT = 0.012;
const MUG_IDLE_BOB_SPEED = 0.0018;
const MUG_DRAG_SCALE_FACTOR = 1.04;
const MUG_RESET_FADE_OUT_MS = 350;
const MUG_RESET_FADE_IN_MS = 250;
const GRABBABLE_CLASS = 'grabbable';

interface UIEl extends Element {
  object3D: THREE.Object3D;
}

interface MaterialState {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

interface SnapAnimation {
  generation: number;
  startPos: THREE.Vector3;
  target: THREE.Vector3;
  elapsedMs: number;
  durationMs: number;
}

interface ResetAnimation {
  generation: number;
  phase: 'fade-out' | 'fade-in';
  elapsedMs: number;
  durationMs: number;
  states: MaterialState[];
  onComplete?: () => void;
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

export class MugDragController {
  private isDragging = false;
  private isPointerOver = false;
  private isSnapping = false;
  private isResetting = false;
  private isInteractionEnabled = true;
  private activeSourceId: string | null = null;
  private readonly originPosition = new THREE.Vector3();
  private readonly startPosition: THREE.Vector3;
  private readonly idleBasePosition: THREE.Vector3;
  private readonly idleScale: THREE.Vector3;
  private dragDepth = 0;
  private hoveredZone: DropZoneHandle | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private materialStates: MaterialState[] | null = null;
  private motionGeneration = 0;
  private resetGeneration = 0;
  private snapAnimation: SnapAnimation | null = null;
  private resetAnimation: ResetAnimation | null = null;
  private readonly opts: {
    mugEl: MugEl;
    sceneEl: SceneEl;
    getDropZones: () => DropZoneHandle[];
    refreshInputRaycasters: () => void;
  };

  constructor(opts: {
    mugEl: MugEl;
    sceneEl: SceneEl;
    getDropZones: () => DropZoneHandle[];
    refreshInputRaycasters: () => void;
  }) {
    this.opts = opts;
    this.startPosition = opts.mugEl.object3D.position.clone();
    this.idleBasePosition = opts.mugEl.object3D.position.clone();
    this.idleScale = opts.mugEl.object3D.scale.clone();
  }

  handleInput(event: DragInputEvent): void {
    switch (event.type) {
      case 'start':
        this.tryBeginDrag(event.ray, event.sourceId);
        break;
      case 'move':
        if (this.isDragging && this.activeSourceId === event.sourceId) this.updateDragFromRay(event.ray);
        break;
      case 'hover':
        if (!this.isDragging && this.isInteractionEnabled && !this.isSnapping && !this.isResetting) {
          this.updatePointerHoverFromRay(event.ray);
        }
        break;
      case 'end':
        this.endDrag(event.sourceId);
        break;
      case 'cancel':
        if (this.activeSourceId === event.sourceId) this.cancelDrag();
        break;
    }
  }

  tick(time: number, delta: number): void {
    if (this.updateResetAnimation(delta)) return;
    if (this.updateSnapAnimation(delta)) return;
    if (this.isDragging || this.isSnapping || this.isResetting) return;

    const bob = Math.sin(time * MUG_IDLE_BOB_SPEED) * MUG_IDLE_BOB_HEIGHT;
    this.opts.mugEl.object3D.position.set(
      this.idleBasePosition.x,
      this.idleBasePosition.y + bob,
      this.idleBasePosition.z,
    );
  }

  setInteractionEnabled(enabled: boolean): void {
    this.isInteractionEnabled = enabled;
    if (!enabled) {
      this.cancelDrag();
      this.isPointerOver = false;
      this.setInteractiveVisual(false);
      this.setHoveredZone(null);
      this.setCanvasCursor('default');
    }
    this.syncRaycastable();
  }

  snapBack(): void {
    const target = this.originPosition.clone();
    const startPos = this.opts.mugEl.object3D.position.clone();
    const generation = ++this.motionGeneration;
    this.isSnapping = true;
    this.syncRaycastable();
    this.snapAnimation = {
      generation,
      startPos,
      target,
      elapsedMs: 0,
      durationMs: 300,
    };
  }

  resetToStartWithFade(onComplete?: () => void): void {
    const generation = ++this.resetGeneration;
    this.motionGeneration += 1;
    this.snapAnimation = null;
    this.resetAnimation = null;
    this.restoreMaterialState();

    const states = this.getMaterialStates();
    this.isResetting = true;
    this.isDragging = false;
    this.isPointerOver = false;
    this.isSnapping = false;
    this.activeSourceId = null;
    this.setHoveredZone(null);
    this.setInteractiveVisual(false);
    this.syncRaycastable();
    this.setCanvasCursor('default');

    if (states.length === 0) {
      this.moveToStart();
      this.isResetting = false;
      this.syncRaycastable();
      onComplete?.();
      return;
    }

    states.forEach(({ material }) => {
      material.transparent = true;
      material.depthWrite = false;
      material.needsUpdate = true;
    });
    this.resetAnimation = {
      generation,
      phase: 'fade-out',
      elapsedMs: 0,
      durationMs: MUG_RESET_FADE_OUT_MS,
      states,
      onComplete,
    };
  }

  dispose(): void {
    this.resetGeneration += 1;
    this.motionGeneration += 1;
    this.snapAnimation = null;
    this.resetAnimation = null;
    this.restoreMaterialState();
    this.setHoveredZone(null);
    this.setRaycastable(true);
  }

  private tryBeginDrag(ray: THREE.Ray, sourceId: string): boolean {
    if (!this.isInteractionEnabled || this.isDragging || this.isSnapping || this.isResetting || this.opts.sceneEl.is('ui-open')) {
      return false;
    }

    this.raycaster.ray.copy(ray);
    if (this.raycaster.intersectObjects(getUIButtons().map((el) => el.object3D), true).length > 0) {
      return false;
    }
    if (this.raycaster.intersectObject(this.opts.mugEl.object3D, true).length === 0) return false;

    this.opts.mugEl.object3D.position.copy(this.idleBasePosition);
    const worldPos = new THREE.Vector3();
    this.opts.mugEl.object3D.getWorldPosition(worldPos);
    this.originPosition.copy(worldPos);

    const pickupOffset = worldPos.clone().sub(ray.origin);
    this.dragDepth = Math.max(0.1, pickupOffset.dot(ray.direction));

    this.isDragging = true;
    this.activeSourceId = sourceId;
    this.setInteractiveVisual(true);
    this.syncRaycastable();
    this.setCanvasCursor('grabbing');
    return true;
  }

  private updateDragFromRay(ray: THREE.Ray): void {
    this.raycaster.ray.copy(ray);
    const zones = this.opts.getDropZones();
    const hits = this.raycaster.intersectObjects(zones.map((zone) => zone.hitMesh), false);

    let newHovered: DropZoneHandle | null = null;
    if (hits.length > 0) {
      const hitMesh = hits[0].object as THREE.Mesh;
      const zone = zones.find((item) => item.hitMesh === hitMesh);
      if (zone) {
        newHovered = zone;
        this.snapMugToZone(zone);
      }
    } else {
      const target = new THREE.Vector3();
      ray.at(this.dragDepth, target);
      this.opts.mugEl.object3D.position.copy(target);
    }

    this.setHoveredZone(newHovered);
  }

  private endDrag(sourceId: string): void {
    if (!this.isDragging) return;
    if (this.activeSourceId !== sourceId) return;

    const droppedZone = this.hoveredZone;
    this.isDragging = false;
    this.activeSourceId = null;
    this.setInteractiveVisual(false);
    if (droppedZone) {
      this.snapMugToZone(droppedZone);
      this.idleBasePosition.copy(this.opts.mugEl.object3D.position);
    }
    this.syncRaycastable();
    this.setCanvasCursor(this.isPointerOver ? 'grab' : 'default');
    this.opts.sceneEl.emit('drag-end', { el: this.opts.mugEl, hoveredZoneEl: droppedZone?.el ?? null });
    if (this.hoveredZone === droppedZone) this.setHoveredZone(null);
  }

  private cancelDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.activeSourceId = null;
    this.opts.mugEl.object3D.position.copy(this.originPosition);
    this.idleBasePosition.copy(this.originPosition);
    this.setInteractiveVisual(false);
    this.setHoveredZone(null);
    this.syncRaycastable();
    this.setCanvasCursor('default');
  }

  private updatePointerHoverFromRay(ray: THREE.Ray): void {
    this.raycaster.ray.copy(ray);
    if (this.raycaster.intersectObjects(getUIButtons().map((el) => el.object3D), true).length > 0) {
      if (this.isPointerOver) {
        this.isPointerOver = false;
        this.setInteractiveVisual(false);
      }
      this.setCanvasCursor('default');
      return;
    }

    const isPointerOver = this.raycaster.intersectObject(this.opts.mugEl.object3D, true).length > 0;
    if (isPointerOver !== this.isPointerOver) {
      this.isPointerOver = isPointerOver;
      this.setInteractiveVisual(isPointerOver);
      this.setCanvasCursor(isPointerOver ? 'grab' : 'default');
    }
  }

  private setHoveredZone(zone: DropZoneHandle | null): void {
    if (zone === this.hoveredZone) return;
    this.hoveredZone?.setHighlight(false);
    zone?.setHighlight(true);
    this.hoveredZone = zone;
  }

  private snapMugToZone(zone: DropZoneHandle): void {
    const zoneWorld = new THREE.Vector3();
    zone.el.object3D.getWorldPosition(zoneWorld);
    this.opts.mugEl.object3D.position.set(zoneWorld.x, zoneWorld.y + MUG_HOVER_OFFSET, zoneWorld.z);
  }

  private setCanvasCursor(cursor: string): void {
    this.opts.sceneEl.canvas.style.cursor = cursor;
  }

  private setInteractiveVisual(active: boolean): void {
    const factor = active ? MUG_DRAG_SCALE_FACTOR : 1;
    this.opts.mugEl.object3D.scale.copy(this.idleScale).multiplyScalar(factor);
  }

  private syncRaycastable(): void {
    this.setRaycastable(this.isInteractionEnabled && !this.isDragging && !this.isSnapping && !this.isResetting);
  }

  private setRaycastable(active: boolean): void {
    this.opts.mugEl.classList.toggle(GRABBABLE_CLASS, active);
    this.opts.refreshInputRaycasters();
  }

  private moveToStart(): void {
    this.opts.mugEl.object3D.position.copy(this.startPosition);
    this.idleBasePosition.copy(this.startPosition);
  }

  private getMaterialStates(): MaterialState[] {
    if (!this.materialStates) {
      this.materialStates = getMeshMaterials(this.opts.mugEl.object3D).map((material) => ({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
      }));
    }
    return this.materialStates;
  }

  private restoreMaterialState(): void {
    this.materialStates?.forEach(({ material, opacity, transparent, depthWrite }) => {
      material.opacity = opacity;
      material.transparent = transparent;
      material.depthWrite = depthWrite;
      material.needsUpdate = true;
    });
  }

  private updateSnapAnimation(delta: number): boolean {
    if (!this.snapAnimation) return false;
    if (this.snapAnimation.generation !== this.motionGeneration) {
      this.snapAnimation = null;
      return false;
    }

    this.snapAnimation.elapsedMs += delta;
    const t = Math.min(this.snapAnimation.elapsedMs / this.snapAnimation.durationMs, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    this.opts.mugEl.object3D.position.lerpVectors(this.snapAnimation.startPos, this.snapAnimation.target, eased);

    if (t >= 1) {
      this.idleBasePosition.copy(this.snapAnimation.target);
      this.snapAnimation = null;
      this.isSnapping = false;
      this.syncRaycastable();
    }
    return true;
  }

  private updateResetAnimation(delta: number): boolean {
    if (!this.resetAnimation) return false;
    if (this.resetAnimation.generation !== this.resetGeneration) {
      this.resetAnimation = null;
      return false;
    }

    this.resetAnimation.elapsedMs += delta;
    const t = Math.min(this.resetAnimation.elapsedMs / this.resetAnimation.durationMs, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const fromFactor = this.resetAnimation.phase === 'fade-out' ? 1 : 0;
    const toFactor = this.resetAnimation.phase === 'fade-out' ? 0 : 1;
    const opacityFactor = THREE.MathUtils.lerp(fromFactor, toFactor, eased);

    this.resetAnimation.states.forEach(({ material, opacity }) => {
      material.opacity = opacity * opacityFactor;
      material.needsUpdate = true;
    });

    if (t < 1) return true;

    if (this.resetAnimation.phase === 'fade-out') {
      this.moveToStart();
      this.resetAnimation = {
        ...this.resetAnimation,
        phase: 'fade-in',
        elapsedMs: 0,
        durationMs: MUG_RESET_FADE_IN_MS,
      };
      return true;
    }

    const onComplete = this.resetAnimation.onComplete;
    this.resetAnimation = null;
    this.restoreMaterialState();
    this.isResetting = false;
    this.syncRaycastable();
    onComplete?.();
    return true;
  }
}
