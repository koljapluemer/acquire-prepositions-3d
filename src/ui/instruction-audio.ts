export class InstructionAudio {
  private readonly audio = document.createElement('audio');
  private audioUrl: string | null = null;

  constructor() {
    this.audio.preload = 'auto';
  }

  setSource(audioUrl: string | null): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.audioUrl = audioUrl;

    if (!audioUrl) return;

    this.audio.src = audioUrl;
    this.audio.load();
  }

  hasAudio(): boolean {
    return this.audioUrl !== null;
  }

  async replay(): Promise<void> {
    if (!this.audioUrl) return;

    try {
      this.audio.currentTime = 0;
      await this.audio.play();
    } catch {
      // Browsers can block playback until the player explicitly presses replay.
    }
  }
}
