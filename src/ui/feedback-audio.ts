const CONFIRMATION_SOUND_URL = new URL('../assets/sound/confirmation_001.ogg', import.meta.url).href;
const ERROR_SOUND_URL = new URL('../assets/sound/error_004.ogg', import.meta.url).href;

type FeedbackSound = 'success' | 'error';

const FEEDBACK_SOUND_URLS: Record<FeedbackSound, string> = {
  success: CONFIRMATION_SOUND_URL,
  error: ERROR_SOUND_URL,
};

export class FeedbackAudio {
  private readonly audioBySound = Object.fromEntries(
    Object.entries(FEEDBACK_SOUND_URLS).map(([sound, url]) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      return [sound, audio];
    }),
  ) as Record<FeedbackSound, HTMLAudioElement>;

  play(sound: FeedbackSound): void {
    const audio = this.audioBySound[sound];
    this.stopOtherSounds(audio);
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Browsers can block playback until audio is unlocked by a user gesture.
    });
  }

  private stopOtherSounds(activeAudio: HTMLAudioElement): void {
    Object.values(this.audioBySound).forEach((audio) => {
      if (audio === activeAudio) return;
      audio.pause();
      audio.currentTime = 0;
    });
  }
}
