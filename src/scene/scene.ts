import type { Zone } from '../types.ts';

const DEBUG_GROUND = false;

// A-Frame axes: x = left/right, y = up/down, z = towards/away from camera
// A-Frame rotation (degrees): x = tilt up/down (pitch), y = turn left/right (yaw), z = roll
const MODEL_SCALE = 0.32;

const LAYOUT = {
  desktopCamera: { x: 0, y: 2.15, z: 3.1 },
  desktopCameraRot: { x: -18, y: 0, z: 0 },
  vrRig: { x: 0, y: 0, z: 2.15 },
  table: { x: -0.8, y: 0.67, z: -0.32 },
  chair: { x: 1.44, y: 0.61, z: -0.22 },
  mug: { x: 0, y: 1.28, z: 1.2 },
  ui: { x: -1.15, y: 2, z: -2 },
  uiRot: { x: 0, y: 0, z: 0 },
  uiScale: { x: 0.48, y: 0.48, z: 0.48 },
};

export const UI_LAYOUT = {
  position: LAYOUT.ui,
  rotation: LAYOUT.uiRot,
  scale: LAYOUT.uiScale,
};

export const ZONES: Zone[] = [
  {
    key: 'table',
    pos: { x: -0.8, y: 1.28, z: -0.32 },
    glossKeys: ['table-on'],
  },
  {
    key: 'chair',
    pos: { x: 1.44, y: 0.8, z: 0 },
    glossKeys: ['chair-on'],
  },
  {
    key: 'between-both',
    pos: { x: 0.86, y: 0.02, z: -0.32 },
    glossKeys: ['chair-next-to', 'table-next-to', 'table-chair-between', 'table-right-of', 'chair-left-of'],
  },
  {
    key: 'table-left-of',
    pos: { x: -2.4, y: 0.02, z: -0.32 },
    glossKeys: ['table-next-to', 'table-left-of'],
  },
  {
    key: 'table-below',
    pos: { x: -1.12, y: 0.02, z: -0.32 },
    glossKeys: ['table-below'],
  },
  {
    key: 'table-in-front-of',
    pos: { x: -1.12, y: 0.02, z: 0.48 },
    glossKeys: ['table-in-front-of', 'table-next-to'],
  },
  {
    key: 'table-behind',
    pos: { x: -1.12, y: 0.02, z: -1.12 },
    glossKeys: ['table-behind', 'table-next-to'],
  },
  {
    key: 'chair-below',
    pos: { x: 1.44, y: 0.02, z: -0.32 },
    glossKeys: ['chair-below'],
  },
  {
    key: 'chair-right-of',
    pos: { x: 2.08, y: 0.02, z: -0.32 },
    glossKeys: ['chair-right-of', 'chair-next-to'],
  },
  {
    key: 'chair-in-front-of',
    pos: { x: 1.44, y: 0.02, z: 0.32 },
    glossKeys: ['chair-in-front-of', 'chair-next-to'],
  },
  {
    key: 'chair-behind',
    pos: { x: 1.44, y: 0.02, z: -0.96 },
    glossKeys: ['chair-behind', 'chair-next-to'],
  }
];

const TABLE_MODEL = new URL('../assets/models/Table.glb', import.meta.url).href;
const CHAIR_MODEL = new URL('../assets/models/Chair.glb', import.meta.url).href;
const MUG_MODEL = new URL('../assets/models/Mug.glb', import.meta.url).href;

function pos(p: { x: number; y: number; z: number }): string {
  return `${p.x} ${p.y} ${p.z}`;
}

function scale(value: number): string {
  return `${value} ${value} ${value}`;
}

export function buildScene(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <a-scene
      renderer="antialias: true"
      xr-mode
      cursor__mouse="rayOrigin: mouse"
      cursor__xrselect="rayOrigin: xrselect"
      raycaster="objects: .ui-interactable, .grabbable"
      shadow="type: pcfsoft">

      <!-- Environment -->
      <a-sky color="#ffffff"></a-sky>
      <a-plane
        position="0 0 0"
        rotation="-90 0 0"
        width="8" height="8"
        ${DEBUG_GROUND ? 'color="#5a8f3c"' : 'shadow-catcher'}
        shadow="receive: true">
      </a-plane>

      <!-- Lighting -->
      <a-light type="ambient" color="#ffffff" intensity="0.6"></a-light>
      <a-light type="directional" position="3 6 2" intensity="0.8" light="castShadow: true; shadowMapWidth: 4096; shadowMapHeight: 4096; shadowCameraLeft: -8; shadowCameraRight: 8; shadowCameraTop: 8; shadowCameraBottom: -8; shadowBias: -0.0005"></a-light>

      <!-- Desktop camera keeps the framed mouse view. The VR camera stays at headset height. -->
      <a-entity
        id="desktop-camera"
        camera
        position="${pos(LAYOUT.desktopCamera)}"
        rotation="${pos(LAYOUT.desktopCameraRot)}"
        mouse-look-limited="maxX: 30; maxY: 60"
        look-controls="enabled: false"
        wasd-controls="enabled: false">
      </a-entity>

      <a-entity
        id="vr-rig"
        position="${pos(LAYOUT.vrRig)}">
        <a-entity
          id="vr-camera"
          camera="active: false"
          look-controls
          wasd-controls="enabled: false">
        </a-entity>
        <a-entity
          id="left-controller"
          laser-controls="hand: left"
          raycaster="objects: .ui-interactable, .grabbable"
          cursor="rayOrigin: entity; fuse: false">
        </a-entity>
        <a-entity
          id="right-controller"
          laser-controls="hand: right"
          raycaster="objects: .ui-interactable, .grabbable"
          cursor="rayOrigin: entity; fuse: false">
        </a-entity>
      </a-entity>

      <!-- Table -->
      <a-entity
        id="table"
        gltf-model="${TABLE_MODEL}"
        scale="${scale(MODEL_SCALE)}"
        position="${pos(LAYOUT.table)}"
        shadow="cast: true; receive: true">
      </a-entity>

      <!-- Chair -->
      <a-entity
        id="chair"
        gltf-model="${CHAIR_MODEL}"
        scale="${scale(MODEL_SCALE)}"
        position="${pos(LAYOUT.chair)}"
        shadow="cast: true; receive: true">
      </a-entity>

      <!-- Mug (draggable) -->
      <a-entity
        id="mug"
        class="grabbable"
        gltf-model="${MUG_MODEL}"
        scale="${scale(MODEL_SCALE)}"
        position="${pos(LAYOUT.mug)}"
        draggable
        shadow="cast: true">
      </a-entity>

      <!-- Drop zones -->
      ${ZONES.map(z => `
      <a-entity
        id="zone-${z.key}"
        position="${pos(z.pos)}"
        drop-zone="label: ${z.key}">
      </a-entity>`).join('')}

    </a-scene>
  `;
}
