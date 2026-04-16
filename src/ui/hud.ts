export class HUD {
  private instruction: HTMLElement;
  private feedback: HTMLElement;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const hud = document.createElement('div');
    hud.id = 'hud';

    this.instruction = document.createElement('div');
    this.instruction.id = 'hud-instruction';

    this.feedback = document.createElement('div');
    this.feedback.id = 'hud-feedback';

    hud.appendChild(this.instruction);
    hud.appendChild(this.feedback);
    document.body.appendChild(hud);
  }

  setInstruction(text: string): void {
    this.instruction.textContent = text;
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
}
