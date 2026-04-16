const DEBUG_GROUND = true;

// A-Frame axes: x = left/right, y = up/down, z = towards/away from camera
// A-Frame rotation (degrees): x = tilt up/down (pitch), y = turn left/right (yaw), z = roll
const LAYOUT = {
  camera:    { x: 0,    y: 6,  z: 6    },
  cameraRot: { x: -30, y: 0, z: 0 },
  table:     { x: -2.5, y: 2.1,z: -1   },
  chair:     { x: 4.5,  y: 1.9,z: -1   },
  mug:       { x: 0,    y: 4,  z: 4.5  },
  zoneTable: { x: -2.5, y: 1.02, z: -1   },
  zoneChair: { x: 2.5,  y: 0.5,  z: -0.8 },
};

const TABLE_MODEL = new URL('../assets/models/Table.glb', import.meta.url).href;
const CHAIR_MODEL = new URL('../assets/models/Chair.glb', import.meta.url).href;
const MUG_MODEL = new URL('../assets/models/Mug.glb', import.meta.url).href;

function pos(p: { x: number; y: number; z: number }): string {
  return `${p.x} ${p.y} ${p.z}`;
}

export function buildScene(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <a-scene renderer="antialias: true" vr-mode-ui="enabled: false" shadow="type: pcfsoft">

      <!-- Environment -->
      <a-sky color="#ffffff"></a-sky>
      <a-plane
        position="0 0 0"
        rotation="-90 0 0"
        width="20" height="20"
        ${DEBUG_GROUND ? 'color="#5a8f3c"' : 'shadow-catcher'}
        shadow="receive: true">
      </a-plane>

      <!-- Lighting -->
      <a-light type="ambient" color="#ffffff" intensity="0.6"></a-light>
      <a-light type="directional" position="3 6 2" intensity="0.8" light="castShadow: true; shadowMapWidth: 2048; shadowMapHeight: 2048"></a-light>

      <!-- Camera (fixed) -->
      <a-entity
        camera
        position="${pos(LAYOUT.camera)}"
        rotation="${pos(LAYOUT.cameraRot)}"
        look-controls="enabled: false"
        wasd-controls="enabled: false">
      </a-entity>

      <!-- Table -->
      <a-entity
        id="table"
        gltf-model="${TABLE_MODEL}"
        scale="1 1 1"
        position="${pos(LAYOUT.table)}"
        shadow="cast: true; receive: true">
      </a-entity>

      <!-- Chair -->
      <a-entity
        id="chair"
        gltf-model="${CHAIR_MODEL}"
        scale="1 1 1"
        position="${pos(LAYOUT.chair)}"
        shadow="cast: true; receive: true">
      </a-entity>

      <!-- Mug (draggable) -->
      <a-entity
        id="mug"
        gltf-model="${MUG_MODEL}"
        scale="1 1 1"
        position="${pos(LAYOUT.mug)}"
        draggable
        shadow="cast: true">
      </a-entity>

      <!-- Drop zone: Table surface -->
      <a-entity
        id="zone-table"
        position="${pos(LAYOUT.zoneTable)}"
        drop-zone="label: table; radius: 0.8">
      </a-entity>

      <!-- Drop zone: Chair seat -->
      <a-entity
        id="zone-chair"
        position="${pos(LAYOUT.zoneChair)}"
        drop-zone="label: chair; radius: 0.6">
      </a-entity>

    </a-scene>
  `;
}
