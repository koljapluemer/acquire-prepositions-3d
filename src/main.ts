import 'aframe';
import type { Scene } from 'aframe';
import './style.css';
import { registerDraggable } from './components/draggable.ts';
import { registerDropZone } from './components/drop-zone.ts';
import { registerMouseLookLimited } from './components/mouse-look-limited.ts';
import { registerShadowCatcher } from './components/shadow-catcher.ts';
import { buildScene, UI_LAYOUT, ZONES } from './scene/scene.ts';
import { Game } from './game/game.ts';
import { DEFAULT_LANGUAGE, getLanguageOptions, loadGlossaryData } from './language/glossary.ts';
import { SceneUI } from './ui/scene-ui.ts';

registerDraggable();
registerDropZone();
registerMouseLookLimited();
registerShadowCatcher();
buildScene();

const sceneEl = document.querySelector('a-scene') as Scene;
sceneEl.addEventListener('loaded', () => {
  void startGame(sceneEl);
});

async function startGame(sceneEl: Scene): Promise<void> {
  await loadGlossaryData();
  let game: Game | null = null;
  const ui = new SceneUI({
    sceneEl,
    position: UI_LAYOUT.position,
    rotation: UI_LAYOUT.rotation,
    languages: getLanguageOptions(),
    selectedLanguage: DEFAULT_LANGUAGE,
    onLanguageChange: (language) => game?.setLanguage(language),
  });
  game = new Game({ ui, sceneEl, zones: ZONES, language: DEFAULT_LANGUAGE });
  game.startRound();
}
