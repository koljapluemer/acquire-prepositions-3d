import * as THREE from 'three';

export function registerShadowCatcher(): void {
  if (AFRAME.components['shadow-catcher']) return;

  AFRAME.registerComponent('shadow-catcher', {
    schema: {
      opacity: { type: 'number', default: 0.35 },
    },

    init(this: { el: Element; data: { opacity: number } }) {
      this.el.addEventListener('object3dset', () => this._applyMaterial());
      this._applyMaterial();
    },

    _applyMaterial(this: { el: Element; data: { opacity: number } }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mesh = (this.el as any).getObject3D('mesh') as THREE.Mesh | undefined;
      if (!mesh) return;
      mesh.material = new THREE.ShadowMaterial({ opacity: this.data.opacity });
      mesh.receiveShadow = true;
    },
  });
}
