import type { Entity } from 'aframe';
import type { GlossPrompt, LanguageOption } from '../language/glossary.ts';
import type { LanguageCode } from '../types.ts';
import { InstructionAudio } from './instruction-audio.ts';

interface Transform {
  x: number;
  y: number;
  z: number;
}

interface SceneUIOptions {
  sceneEl: Entity;
  position: Transform;
  rotation: Transform;
  languages: LanguageOption[];
  selectedLanguage: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
}

type FeedbackType = 'success' | 'error';

const UI = {
  panelWidth: 3.0,
  promptHeight: 0.58,
  replayHeight: 0.34,
  feedbackHeight: 0.28,
  titleHeight: 0.22,
  rowHeight: 0.28,
  gap: 0.08,
  padding: 0.16,
  z: {
    panel: 0,
    row: 0.012,
    text: 0.024,
    mark: 0.03,
  },
  colors: {
    panel: '#f8fafc',
    prompt: '#111827',
    row: '#ffffff',
    rowHover: '#e5e7eb',
    rowSelected: '#287271',
    rowPressed: '#174f4e',
    border: '#d1d5db',
    text: '#111827',
    textMuted: '#4b5563',
    textInverse: '#ffffff',
    success: '#16a34a',
    error: '#dc2626',
  },
};

interface SelectableRow {
  root: Entity;
  background: Entity;
  label: Entity;
  marker: Entity | null;
  value: LanguageCode;
  selected: boolean;
  hover: boolean;
  pressed: boolean;
}

export class SceneUI {
  private readonly sceneEl: Entity;
  private readonly root: Entity;
  private readonly instruction: Entity;
  private readonly replayButton: SelectableRow;
  private readonly feedbackBackground: Entity;
  private readonly feedback: Entity;
  private readonly audio = new InstructionAudio();
  private readonly languages: LanguageOption[];
  private readonly onLanguageChange: (language: LanguageCode) => void;
  private readonly languageRows = new Map<LanguageCode, SelectableRow>();
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private selectedLanguage: LanguageCode;

  constructor(opts: SceneUIOptions) {
    this.sceneEl = opts.sceneEl;
    this.languages = opts.languages;
    this.selectedLanguage = opts.selectedLanguage;
    this.onLanguageChange = opts.onLanguageChange;

    const rowCount = this.languages.length;
    const panelHeight = (
      UI.padding * 2
      + UI.promptHeight
      + UI.replayHeight
      + UI.feedbackHeight
      + UI.titleHeight
      + rowCount * UI.rowHeight
      + 5 * UI.gap
      + Math.max(0, rowCount - 1) * (UI.gap * 0.45)
    );

    this.root = document.createElement('a-entity') as Entity;
    this.root.id = 'scene-ui';
    this.root.setAttribute('position', this.formatTransform(opts.position));
    this.root.setAttribute('rotation', this.formatTransform(opts.rotation));
    this.sceneEl.appendChild(this.root);

    this.root.appendChild(this.createPlane(0, 0, UI.panelWidth, panelHeight, UI.colors.panel, UI.z.panel, 0.96));

    const contentTop = panelHeight / 2 - UI.padding;
    const left = -UI.panelWidth / 2 + UI.padding;
    const contentWidth = UI.panelWidth - UI.padding * 2;
    let y = contentTop;

    this.instruction = this.createText({
      x: 0,
      y: y - UI.promptHeight / 2,
      z: UI.z.text,
      value: '',
      width: contentWidth - 0.22,
      wrapCount: 30,
      color: UI.colors.textInverse,
      size: 0.19,
      align: 'center',
    });
    this.root.appendChild(this.createPlane(0, y - UI.promptHeight / 2, contentWidth, UI.promptHeight, UI.colors.prompt, UI.z.row, 0.94));
    this.root.appendChild(this.instruction);
    y -= UI.promptHeight + UI.gap;

    this.replayButton = this.createButtonRow({
      value: '__replay__',
      label: 'Replay audio',
      x: 0,
      y: y - UI.replayHeight / 2,
      width: contentWidth,
      height: UI.replayHeight,
      selected: false,
      inverse: true,
      marker: false,
      onSelect: () => void this.audio.replay(),
    });
    this.root.appendChild(this.replayButton.root);
    y -= UI.replayHeight + UI.gap;

    this.feedback = this.createText({
      x: 0,
      y: y - UI.feedbackHeight / 2,
      z: UI.z.text,
      value: '',
      width: contentWidth - 0.2,
      wrapCount: 20,
      color: UI.colors.textInverse,
      size: 0.13,
      align: 'center',
    });
    this.feedbackBackground = this.createPlane(0, y - UI.feedbackHeight / 2, contentWidth, UI.feedbackHeight, UI.colors.prompt, UI.z.row, 0.86);
    this.feedbackBackground.setAttribute('visible', false);
    this.root.appendChild(this.feedbackBackground);
    this.feedback.setAttribute('visible', false);
    this.root.appendChild(this.feedback);
    y -= UI.feedbackHeight + UI.gap;

    const title = this.createText({
      x: left,
      y: y - UI.titleHeight / 2,
      z: UI.z.text,
      value: 'Practice language',
      width: contentWidth,
      wrapCount: 24,
      color: UI.colors.textMuted,
      size: 0.12,
      align: 'left',
    });
    this.root.appendChild(title);
    y -= UI.titleHeight + UI.gap * 0.55;

    for (const language of this.languages) {
      const row = this.createButtonRow({
        value: language.code,
        label: language.displayName,
        x: 0,
        y: y - UI.rowHeight / 2,
        width: contentWidth,
        height: UI.rowHeight,
        selected: language.code === this.selectedLanguage,
        inverse: false,
        marker: true,
        onSelect: () => {
          if (this.selectedLanguage === language.code) return;
          this.selectedLanguage = language.code;
          this.onLanguageChange(language.code);
          this.syncLanguageRows();
        },
      });
      this.languageRows.set(language.code, row);
      this.root.appendChild(row.root);
      y -= UI.rowHeight + UI.gap * 0.45;
    }

    this.syncLanguageRows();
  }

  setInstruction(prompt: GlossPrompt): void {
    this.instruction.setAttribute('text', this.getTextAttribute({
      value: prompt.text,
      width: UI.panelWidth - UI.padding * 2 - 0.22,
      wrapCount: 30,
      color: UI.colors.textInverse,
      size: 0.19,
      align: 'center',
    }));
    this.audio.setSource(prompt.audioUrl);
    this.setRowEnabled(this.replayButton, this.audio.hasAudio());
    void this.audio.replay();
  }

  showFeedback(text: string, type: FeedbackType): void {
    if (this.feedbackTimer !== null) clearTimeout(this.feedbackTimer);
    this.feedback.setAttribute('text', this.getTextAttribute({
      value: text,
      width: UI.panelWidth - UI.padding * 2 - 0.2,
      wrapCount: 20,
      color: this.getFeedbackColor(type),
      size: 0.13,
      align: 'center',
    }));
    this.feedbackBackground.setAttribute('visible', true);
    this.feedback.setAttribute('visible', true);
    this.feedbackTimer = setTimeout(() => {
      this.feedbackBackground.setAttribute('visible', false);
      this.feedback.setAttribute('visible', false);
      this.feedbackTimer = null;
    }, 1200);
  }

  private createButtonRow(opts: {
    value: LanguageCode;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    selected: boolean;
    inverse: boolean;
    marker: boolean;
    onSelect: () => void;
  }): SelectableRow {
    const root = document.createElement('a-entity') as Entity;
    root.setAttribute('position', `${opts.x} ${opts.y} 0`);
    root.classList.add('ui-interactable');
    root.setAttribute('geometry', { primitive: 'plane', width: opts.width, height: opts.height });
    root.setAttribute('material', { color: '#ffffff', shader: 'flat', transparent: true, opacity: 0 });

    const background = this.createPlane(0, 0, opts.width, opts.height, UI.colors.row, UI.z.row, 1);
    background.classList.add('ui-interactable');
    root.appendChild(background);

    const marker = opts.marker
      ? this.createCircle(-opts.width / 2 + 0.18, 0, 0.045, UI.colors.border, UI.z.mark)
      : null;
    if (marker) root.appendChild(marker);

    const label = this.createText({
      x: -opts.width / 2 + (opts.marker ? 0.3 : 0.16),
      y: 0,
      z: UI.z.text,
      value: opts.label,
      width: opts.width - (opts.marker ? 0.42 : 0.32),
      wrapCount: 24,
      color: opts.inverse ? UI.colors.textInverse : UI.colors.text,
      size: 0.13,
      align: 'left',
    });
    root.appendChild(label);

    const row: SelectableRow = {
      root,
      background,
      label,
      marker,
      value: opts.value,
      selected: opts.selected,
      hover: false,
      pressed: false,
    };

    root.addEventListener('mouseenter', () => {
      row.hover = true;
      this.syncRowVisual(row, opts.inverse);
    });
    root.addEventListener('mouseleave', () => {
      row.hover = false;
      row.pressed = false;
      this.syncRowVisual(row, opts.inverse);
    });
    root.addEventListener('mousedown', () => {
      row.pressed = true;
      this.syncRowVisual(row, opts.inverse);
    });
    root.addEventListener('mouseup', () => {
      row.pressed = false;
      this.syncRowVisual(row, opts.inverse);
    });
    root.addEventListener('click', opts.onSelect);

    this.syncRowVisual(row, opts.inverse);
    return row;
  }

  private syncLanguageRows(): void {
    for (const [code, row] of this.languageRows) {
      row.selected = code === this.selectedLanguage;
      this.syncRowVisual(row, false);
    }
  }

  private setRowEnabled(row: SelectableRow, enabled: boolean): void {
    row.root.setAttribute('visible', enabled);
    if (enabled) {
      row.root.classList.add('ui-interactable');
    } else {
      row.root.classList.remove('ui-interactable');
    }
  }

  private syncRowVisual(row: SelectableRow, inverse: boolean): void {
    const color = row.pressed
      ? UI.colors.rowPressed
      : row.selected
        ? UI.colors.rowSelected
        : row.hover
          ? UI.colors.rowHover
          : inverse
            ? UI.colors.prompt
            : UI.colors.row;
    const textColor = row.selected || inverse || row.pressed ? UI.colors.textInverse : UI.colors.text;
    const markerColor = row.selected || row.pressed ? UI.colors.textInverse : UI.colors.border;

    row.background.setAttribute('material', { color, shader: 'flat', transparent: true, opacity: 1 });
    row.marker?.setAttribute('material', { color: markerColor, shader: 'flat', transparent: true, opacity: row.selected ? 1 : 0.72 });
    row.label.setAttribute('text', 'color', textColor);
  }

  private createPlane(x: number, y: number, width: number, height: number, color: string, z: number, opacity: number): Entity {
    const plane = document.createElement('a-entity') as Entity;
    plane.setAttribute('position', `${x} ${y} ${z}`);
    plane.setAttribute('geometry', { primitive: 'plane', width, height });
    plane.setAttribute('material', { color, shader: 'flat', transparent: true, opacity });
    return plane;
  }

  private createCircle(x: number, y: number, radius: number, color: string, z: number): Entity {
    const circle = document.createElement('a-entity') as Entity;
    circle.setAttribute('position', `${x} ${y} ${z}`);
    circle.setAttribute('geometry', { primitive: 'circle', radius, segments: 32 });
    circle.setAttribute('material', { color, shader: 'flat', transparent: true });
    return circle;
  }

  private createText(opts: {
    x: number;
    y: number;
    z: number;
    value: string;
    width: number;
    wrapCount: number;
    color: string;
    size: number;
    align: 'left' | 'center';
  }): Entity {
    const text = document.createElement('a-entity') as Entity;
    text.setAttribute('position', `${opts.x} ${opts.y} ${opts.z}`);
    text.setAttribute('text', this.getTextAttribute(opts));
    return text;
  }

  private getTextAttribute(opts: {
    value: string;
    width: number;
    wrapCount: number;
    color: string;
    size: number;
    align: 'left' | 'center';
  }): Record<string, string | number> {
    return {
      value: opts.value,
      width: opts.width,
      wrapCount: opts.wrapCount,
      color: opts.color,
      align: opts.align,
      anchor: opts.align,
      baseline: 'center',
      shader: 'msdf',
      letterSpacing: 0,
      lineHeight: 52,
      zOffset: 0.002,
      height: opts.size,
    };
  }

  private getFeedbackColor(type: FeedbackType): string {
    return type === 'success' ? UI.colors.success : UI.colors.error;
  }

  private formatTransform(transform: Transform): string {
    return `${transform.x} ${transform.y} ${transform.z}`;
  }
}
