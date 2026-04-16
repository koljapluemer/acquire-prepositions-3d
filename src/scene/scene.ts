const TABLE_MODEL = new URL('../assets/models/Table.glb', import.meta.url).href;
const CHAIR_MODEL = new URL('../assets/models/Chair.glb', import.meta.url).href;
const MUG_MODEL = new URL('../assets/models/Mug.glb', import.meta.url).href;

export function buildScene(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <a-scene renderer="antialias: true" vr-mode-ui="enabled: false">

      <!-- Environment -->
      <a-sky color="#87CEEB"></a-sky>
      <a-plane
        position="0 0 0"
        rotation="-90 0 0"
        width="20" height="20"
        color="#5a8f3c"
        shadow="receive: true">
      </a-plane>

      <!-- Lighting -->
      <a-light type="ambient" color="#ffffff" intensity="0.6"></a-light>
      <a-light type="directional" position="3 6 2" intensity="0.8" shadow="cast: true"></a-light>

      <!-- Camera (fixed) -->
      <a-entity
        camera
        position="0 1.6 5"
        look-controls="enabled: false"
        wasd-controls="enabled: false">
      </a-entity>

      <!-- Table -->
      <a-entity
        id="table"
        gltf-model="${TABLE_MODEL}"
        scale="1 1 1"
        position="-2.5 0.545 -1"
        shadow="cast: true; receive: true">
      </a-entity>

      <!-- Chair -->
      <a-entity
        id="chair"
        gltf-model="${CHAIR_MODEL}"
        scale="1 1 1"
        position="2.5 0.585 -1"
        shadow="cast: true; receive: true">
      </a-entity>

      <!-- Mug (draggable) -->
      <a-entity
        id="mug"
        gltf-model="${MUG_MODEL}"
        scale="1 1 1"
        position="0 1.1 2.5"
        draggable
        shadow="cast: true">
      </a-entity>

      <!-- Drop zone: Table surface -->
      <a-entity
        id="zone-table"
        position="-2.5 1.02 -1"
        drop-zone="label: table; radius: 0.8">
      </a-entity>

      <!-- Drop zone: Chair seat -->
      <a-entity
        id="zone-chair"
        position="2.5 0.5 -0.8"
        drop-zone="label: chair; radius: 0.6">
      </a-entity>

    </a-scene>
  `;
}
