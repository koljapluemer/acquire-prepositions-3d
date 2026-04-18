import 'aframe';
import './style.css';
import { registerDraggable } from './components/draggable.ts';
import { registerDropZone } from './components/drop-zone.ts';
import { registerMouseLookLimited } from './components/mouse-look-limited.ts';
import { registerShadowCatcher } from './components/shadow-catcher.ts';
import { buildScene, ZONES } from './scene/scene.ts';
import { HUD } from './ui/hud.ts';
import { Game } from './game/game.ts';
import { DEFAULT_LANGUAGE, getLanguageOptions } from './language/glossary.ts';

registerDraggable();
registerDropZone();
registerMouseLookLimited();
registerShadowCatcher();
buildScene();

const sceneEl = document.querySelector('a-scene')!;
sceneEl.addEventListener('loaded', () => {
  let game: Game | null = null;
  const hud = new HUD({
    languages: getLanguageOptions(),
    selectedLanguage: DEFAULT_LANGUAGE,
    onLanguageChange: (language) => game?.setLanguage(language),
  });
  game = new Game({ hud, sceneEl, zones: ZONES, language: DEFAULT_LANGUAGE });
  game.startRound();
});
