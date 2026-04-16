import 'aframe';
import './style.css';
import { registerDraggable } from './components/draggable.ts';
import { registerDropZone } from './components/drop-zone.ts';
import { buildScene } from './scene/scene.ts';
import { HUD } from './ui/hud.ts';
import { Game } from './game/game.ts';

registerDraggable();
registerDropZone();
buildScene();

const sceneEl = document.querySelector('a-scene')!;
sceneEl.addEventListener('loaded', () => {
  const hud = new HUD();
  const game = new Game({ hud, sceneEl });
  game.startRound();
});
