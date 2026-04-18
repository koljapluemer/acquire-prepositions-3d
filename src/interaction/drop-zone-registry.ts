import type * as THREE from 'three';
import type { DropZoneEl, DropZoneHandle } from './types.ts';

interface DropZoneComponent {
  hitMesh: THREE.Mesh;
  isUnlocked: boolean;
  setHighlight(active: boolean): void;
}

export function getUnlockedDropZones(): DropZoneHandle[] {
  return Array.from(document.querySelectorAll('[drop-zone]'))
    .map((el) => ({
      el: el as DropZoneEl,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: (el as any).components['drop-zone'] as DropZoneComponent | undefined,
    }))
    .filter((zone): zone is { el: DropZoneEl; component: DropZoneComponent } => Boolean(zone.component?.isUnlocked))
    .map(({ el, component }) => ({
      el,
      hitMesh: component.hitMesh,
      setHighlight: (active: boolean) => component.setHighlight(active),
    }));
}
