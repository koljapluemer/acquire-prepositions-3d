type InteractionMode = 'desktop' | 'vr';

interface XrModeEl extends Element {
  emit(name: string, detail?: unknown): void;
}

interface XrModeInstance {
  el: XrModeEl;
  mode: InteractionMode;
  _onEnterVr: () => void;
  _onExitVr: () => void;
  setMode(mode: InteractionMode): void;
}

export function registerXrMode(): void {
  if (AFRAME.components['xr-mode']) return;

  AFRAME.registerComponent('xr-mode', {
    mode: 'desktop' as InteractionMode,

    init(this: XrModeInstance) {
      this.mode = 'desktop';
      this._onEnterVr = () => this.setMode('vr');
      this._onExitVr = () => this.setMode('desktop');
      this.el.addEventListener('enter-vr', this._onEnterVr);
      this.el.addEventListener('exit-vr', this._onExitVr);
      this.setMode('desktop');
    },

    remove(this: XrModeInstance) {
      this.el.removeEventListener('enter-vr', this._onEnterVr);
      this.el.removeEventListener('exit-vr', this._onExitVr);
    },

    setMode(this: XrModeInstance, mode: InteractionMode) {
      if (this.mode === mode) return;
      this.mode = mode;
      this.el.emit('interaction-mode-change', { mode });
    },
  });
}
