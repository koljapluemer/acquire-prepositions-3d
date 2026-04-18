import type { Game } from '../game/game.ts';

let activeGame: Game | null = null;

interface GameTickerInstance {
  tick(time: number, delta: number): void;
}

export function setGameTickerGame(game: Game | null): void {
  activeGame = game;
}

export function registerGameTicker(): void {
  if (AFRAME.components['game-ticker']) return;

  AFRAME.registerComponent('game-ticker', {
    tick(this: GameTickerInstance, time: number, delta: number) {
      activeGame?.tick(time, delta);
    },
  });
}
