import type { LanguageCode } from '../types.ts';
import type { GlossPrompt, LanguageOption } from '../language/glossary.ts';

interface HUDOptions {
  languages: LanguageOption[];
  selectedLanguage: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
}

export class HUD {
  private instruction: HTMLElement;
  private audioButton: HTMLButtonElement;
  private instructionAudio: HTMLAudioElement;
  private feedback: HTMLElement;
  private settingsButton: HTMLButtonElement;
  private modal: HTMLElement;
  private languageSelect: HTMLSelectElement;
  private readonly languages: LanguageOption[];
  private readonly onLanguageChange: (language: LanguageCode) => void;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: HUDOptions) {
    this.languages = opts.languages;
    this.onLanguageChange = opts.onLanguageChange;

    const hud = document.createElement('div');
    hud.id = 'hud';

    this.settingsButton = document.createElement('button');
    this.settingsButton.id = 'settings-button';
    this.settingsButton.type = 'button';
    this.settingsButton.addEventListener('click', () => this.openSettings());

    this.instruction = document.createElement('div');
    this.instruction.id = 'hud-instruction';

    this.audioButton = document.createElement('button');
    this.audioButton.id = 'audio-replay-button';
    this.audioButton.type = 'button';
    this.audioButton.textContent = 'Play audio';
    this.audioButton.addEventListener('click', () => this.replayInstructionAudio());

    this.instructionAudio = document.createElement('audio');
    this.instructionAudio.preload = 'auto';

    this.feedback = document.createElement('div');
    this.feedback.id = 'hud-feedback';

    hud.appendChild(this.settingsButton);
    hud.appendChild(this.instruction);
    hud.appendChild(this.audioButton);
    hud.appendChild(this.instructionAudio);
    hud.appendChild(this.feedback);
    document.body.appendChild(hud);

    const { modal, languageSelect } = this.createSettingsModal(opts.selectedLanguage);
    this.modal = modal;
    this.languageSelect = languageSelect;
    document.body.appendChild(this.modal);
    this.updateSettingsButton(opts.selectedLanguage);
  }

  setInstruction(prompt: GlossPrompt): void {
    this.instruction.textContent = prompt.text;
    this.setInstructionAudio(prompt.audioUrl);
  }

  showFeedback(text: string, type: 'success' | 'error'): void {
    if (this.feedbackTimer !== null) clearTimeout(this.feedbackTimer);
    this.feedback.textContent = text;
    this.feedback.className = `visible ${type}`;
    this.feedbackTimer = setTimeout(() => {
      this.feedback.className = '';
      this.feedbackTimer = null;
    }, 1200);
  }

  private createSettingsModal(selectedLanguage: LanguageCode): {
    modal: HTMLElement;
    languageSelect: HTMLSelectElement;
  } {
    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.className = 'hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'settings-title');

    const panel = document.createElement('div');
    panel.id = 'settings-panel';

    const title = document.createElement('h2');
    title.id = 'settings-title';
    title.textContent = 'Settings';

    const label = document.createElement('label');
    label.htmlFor = 'language-select';
    label.textContent = 'Practice language';

    const languageSelect = document.createElement('select');
    languageSelect.id = 'language-select';
    for (const language of this.languages) {
      const option = document.createElement('option');
      option.value = language.code;
      option.textContent = language.displayName;
      languageSelect.appendChild(option);
    }
    languageSelect.value = selectedLanguage;

    const actions = document.createElement('div');
    actions.id = 'settings-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => this.closeSettings());

    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save';
    save.addEventListener('click', () => {
      const selected = languageSelect.value;
      this.onLanguageChange(selected);
      this.updateSettingsButton(selected);
      this.closeSettings();
    });

    actions.appendChild(cancel);
    actions.appendChild(save);
    panel.appendChild(title);
    panel.appendChild(label);
    panel.appendChild(languageSelect);
    panel.appendChild(actions);
    modal.appendChild(panel);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.closeSettings();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeSettings();
    });

    return { modal, languageSelect };
  }

  private openSettings(): void {
    this.modal.classList.remove('hidden');
    this.languageSelect.focus();
  }

  private closeSettings(): void {
    this.modal.classList.add('hidden');
  }

  private setInstructionAudio(audioUrl: string | null): void {
    this.instructionAudio.pause();
    this.instructionAudio.removeAttribute('src');
    this.instructionAudio.load();

    if (!audioUrl) {
      this.audioButton.hidden = true;
      this.audioButton.disabled = true;
      return;
    }

    this.instructionAudio.src = audioUrl;
    this.instructionAudio.load();
    this.audioButton.hidden = false;
    this.audioButton.disabled = false;
    this.audioButton.textContent = 'Replay audio';
    this.audioButton.setAttribute('aria-label', 'Replay instruction audio');
    void this.replayInstructionAudio();
  }

  private async replayInstructionAudio(): Promise<void> {
    if (!this.instructionAudio.src) return;

    try {
      this.instructionAudio.currentTime = 0;
      await this.instructionAudio.play();
    } catch {
      // Browsers can block playback until the player presses the replay button.
    }
  }

  private updateSettingsButton(languageCode: LanguageCode): void {
    const language = this.languages.find((item) => item.code === languageCode);
    this.settingsButton.textContent = language ? `Language: ${language.displayName}` : 'Language';
  }
}
