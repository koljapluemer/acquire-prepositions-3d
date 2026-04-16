import * as THREE from 'three';

export function registerDraggable(): void {
  if (AFRAME.components['draggable']) return;

  AFRAME.registerComponent('draggable', {
    isDragging: false,
    originPosition: null as THREE.Vector3 | null,
    dragPlane: null as THREE.Plane | null,
    raycaster: null as THREE.Raycaster | null,
    intersectPoint: null as THREE.Vector3 | null,

    init(this: ReturnType<typeof AFRAME.registerComponent> & {
      isDragging: boolean;
      originPosition: THREE.Vector3 | null;
      dragPlane: THREE.Plane | null;
      raycaster: THREE.Raycaster | null;
      intersectPoint: THREE.Vector3 | null;
      el: HTMLElement & { object3D: THREE.Object3D; sceneEl: { canvas: HTMLCanvasElement; camera: THREE.Camera; emit: (name: string, detail?: unknown) => void } };
      _onCanvasMouseDown: (e: MouseEvent) => void;
      _onWindowMouseMove: (e: MouseEvent) => void;
      _onWindowMouseUp: () => void;
    }) {
      this.isDragging = false;
      this.originPosition = new THREE.Vector3();
      this.dragPlane = new THREE.Plane();
      this.raycaster = new THREE.Raycaster();
      this.intersectPoint = new THREE.Vector3();

      this._onCanvasMouseDown = this._onCanvasMouseDown.bind(this);
      this._onWindowMouseMove = this._onWindowMouseMove.bind(this);
      this._onWindowMouseUp = this._onWindowMouseUp.bind(this);

      this.el.sceneEl.canvas.addEventListener('mousedown', this._onCanvasMouseDown);
      window.addEventListener('mousemove', this._onWindowMouseMove);
      window.addEventListener('mouseup', this._onWindowMouseUp);
    },

    remove(this: { el: { object3D: THREE.Object3D; sceneEl: { canvas: HTMLCanvasElement } }; _onCanvasMouseDown: (e: MouseEvent) => void; _onWindowMouseMove: (e: MouseEvent) => void; _onWindowMouseUp: () => void }) {
      this.el.sceneEl.canvas.removeEventListener('mousedown', this._onCanvasMouseDown);
      window.removeEventListener('mousemove', this._onWindowMouseMove);
      window.removeEventListener('mouseup', this._onWindowMouseUp);
    },

    _onCanvasMouseDown(this: { el: { object3D: THREE.Object3D; sceneEl: { canvas: HTMLCanvasElement; camera: THREE.Camera; emit: (name: string, detail?: unknown) => void } }; isDragging: boolean; originPosition: THREE.Vector3; dragPlane: THREE.Plane; raycaster: THREE.Raycaster }, evt: MouseEvent) {
      const canvas = this.el.sceneEl.canvas;
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((evt.clientX - rect.left) / rect.width) * 2 - 1,
        -((evt.clientY - rect.top) / rect.height) * 2 + 1,
      );

      this.raycaster.setFromCamera(mouse, this.el.sceneEl.camera);
      const hits = this.raycaster.intersectObject(this.el.object3D, true);
      if (hits.length === 0) return;

      this.el.object3D.getWorldPosition(this.originPosition);
      this.dragPlane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        this.originPosition,
      );
      this.isDragging = true;
      canvas.style.cursor = 'grabbing';
      this.el.sceneEl.emit('drag-start', { el: this.el });
    },

    _onWindowMouseMove(this: { el: { object3D: THREE.Object3D; sceneEl: { canvas: HTMLCanvasElement; camera: THREE.Camera; emit: (name: string, detail?: unknown) => void } }; isDragging: boolean; dragPlane: THREE.Plane; raycaster: THREE.Raycaster; intersectPoint: THREE.Vector3 }, evt: MouseEvent) {
      if (!this.isDragging) return;

      const canvas = this.el.sceneEl.canvas;
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((evt.clientX - rect.left) / rect.width) * 2 - 1,
        -((evt.clientY - rect.top) / rect.height) * 2 + 1,
      );

      this.raycaster.setFromCamera(mouse, this.el.sceneEl.camera);
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.intersectPoint)) {
        this.el.object3D.position.copy(this.intersectPoint);
      }

      const worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);
      this.el.sceneEl.emit('drag-move', { position: worldPos });
    },

    _onWindowMouseUp(this: { el: { object3D: THREE.Object3D; sceneEl: { canvas: HTMLCanvasElement; emit: (name: string, detail?: unknown) => void } }; isDragging: boolean }) {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.el.sceneEl.canvas.style.cursor = 'default';

      const worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);
      this.el.sceneEl.emit('drag-end', { el: this.el, position: worldPos });
    },

    snapBack(this: { el: { object3D: THREE.Object3D }; originPosition: THREE.Vector3 }) {
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
