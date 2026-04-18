export class InstructionAudio {
  private readonly audio = document.createElement('audio');
  private audioUrl: string | null = null;
  private unlocked = false;

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

  isUnlocked(): boolean {
    return this.unlocked;
  }

  async replay(): Promise<boolean> {
    if (!this.audioUrl) return false;

    try {
      this.audio.currentTime = 0;
      await this.audio.play();
      this.unlocked = true;
      return true;
    } catch {
      // Browsers can block playback until the player explicitly presses replay.
      return false;
    }
  }
}
