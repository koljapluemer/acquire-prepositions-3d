import type { Entity } from 'aframe';
import * as THREE from 'three';
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
  scale: Transform;
  languages: LanguageOption[];
  selectedLanguage: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
  onStart: () => void;
  onExit: () => void;
  onAudioReplay: () => void;
}

type FeedbackType = 'success' | 'error';
type SceneUIState = 'pre-game' | 'running';

const TEXTURE_SCALE = 4;

const UI = {
  panelWidth: 3.0,
  promptHeight: 0.58,
  replayHeight: 0.34,
  feedbackHeight: 0.28,
  titleHeight: 0.22,
  descriptionHeight: 0.34,
  noticeHeight: 0.46,
  rowHeight: 0.28,
  startHeight: 0.36,
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

const INSTRUCTION_FONT_FAMILY = [
  'system-ui',
  '"Segoe UI"',
  '"Noto Sans"',
  '"Noto Sans Arabic"',
  '"Noto Sans Thai"',
  '"Noto Sans Vietnamese"',
  'Arial',
  'sans-serif',
].join(', ');

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
  private readonly startGroup: Entity;
  private readonly startButton: SelectableRow;
  private readonly gameGroup: Entity;
  private readonly instruction: CanvasTextPanel;
  private readonly exitButton: SelectableRow;
  private readonly replayButton: SelectableRow;
  private readonly feedbackBackground: Entity;
  private readonly feedback: Entity;
  private readonly audio = new InstructionAudio();
  private readonly languages: LanguageOption[];
  private readonly onLanguageChange: (language: LanguageCode) => void;
  private readonly onStart: () => void;
  private readonly onExit: () => void;
  private readonly onAudioReplay: () => void;
  private readonly languageRows = new Map<LanguageCode, SelectableRow>();
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private selectedLanguage: LanguageCode;
  private state: SceneUIState = 'pre-game';

  constructor(opts: SceneUIOptions) {
    this.sceneEl = opts.sceneEl;
    this.languages = opts.languages;
    this.selectedLanguage = opts.selectedLanguage;
    this.onLanguageChange = opts.onLanguageChange;
    this.onStart = opts.onStart;
    this.onExit = opts.onExit;
    this.onAudioReplay = opts.onAudioReplay;

    const rowCount = this.languages.length;
    const languageRowsHeight = (
      rowCount * UI.rowHeight
      + Math.max(0, rowCount - 1) * (UI.gap * 0.45)
    );
    const startPanelHeight = (
      UI.padding * 2
      + UI.titleHeight
      + UI.descriptionHeight
      + languageRowsHeight
      + UI.noticeHeight
      + UI.startHeight
      + 4 * UI.gap
    );
    const gamePanelHeight = (
      UI.padding * 2
      + UI.promptHeight
      + UI.replayHeight
      + UI.replayHeight
      + UI.feedbackHeight
      + 3 * UI.gap
    );

    this.root = document.createElement('a-entity') as Entity;
    this.root.id = 'scene-ui';
    this.root.setAttribute('position', this.formatTransform(opts.position));
    this.root.setAttribute('rotation', this.formatTransform(opts.rotation));
    this.root.setAttribute('scale', this.formatTransform(opts.scale));
    this.sceneEl.appendChild(this.root);

    this.startGroup = document.createElement('a-entity') as Entity;
    this.root.appendChild(this.startGroup);
    this.startGroup.appendChild(this.createPlane(0, 0, UI.panelWidth, startPanelHeight, UI.colors.panel, UI.z.panel, 0.96));
    const startContentTop = startPanelHeight / 2 - UI.padding;
    const contentWidth = UI.panelWidth - UI.padding * 2;
    let y = startContentTop;

    const startTitle = this.createText({
      x: 0,
      y: y - UI.titleHeight / 2,
      z: UI.z.text,
      value: 'Practice language',
      width: contentWidth,
      wrapCount: 28,
      color: UI.colors.text,
      size: 0.14,
      align: 'center',
    });
    this.startGroup.appendChild(startTitle);
    y -= UI.titleHeight + UI.gap;

    const description = this.createText({
      x: 0,
      y: y - UI.descriptionHeight / 2,
      z: UI.z.text,
      value: 'Listen to each prompt, then move the mug to the matching place around the table or chair. New targets unlock as you keep practicing.',
      width: contentWidth,
      wrapCount: 48,
      color: UI.colors.textMuted,
      size: 0.075,
      align: 'center',
    });
    this.startGroup.appendChild(description);
    y -= UI.descriptionHeight + UI.gap;

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
          if (this.state !== 'pre-game') return;
          if (this.selectedLanguage === language.code) return;
          this.selectedLanguage = language.code;
          this.onLanguageChange(language.code);
          this.syncLanguageRows();
        },
      });
      this.languageRows.set(language.code, row);
      this.startGroup.appendChild(row.root);
      y -= UI.rowHeight + UI.gap * 0.45;
    }

    y -= UI.gap * 0.55;
    const privacyNotice = this.createText({
      x: 0,
      y: y - UI.noticeHeight / 2,
      z: UI.z.text,
      value: 'Made by Kolja Sam (koljasam.com). I track page views and pseudonymous learning data, which I may use for (academic) research. Nothing else. Enjoy the game.',
      width: contentWidth,
      wrapCount: 56,
      color: UI.colors.textMuted,
      size: 0.065,
      align: 'center',
    });
    this.makeClickableLink(privacyNotice, contentWidth, UI.noticeHeight, 'https://koljasam.com');
    this.startGroup.appendChild(privacyNotice);
    y -= UI.noticeHeight + UI.gap;

    this.startButton = this.createButtonRow({
      value: '__start__',
      label: 'Start game',
      x: 0,
      y: y - UI.startHeight / 2,
      width: contentWidth,
      height: UI.startHeight,
      selected: false,
      inverse: true,
      marker: false,
      onSelect: () => {
        if (this.state !== 'pre-game') return;
        this.setState('running');
        this.onStart();
        void this.replayInstructionAudio(false);
      },
    });
    this.startGroup.appendChild(this.startButton.root);

    this.gameGroup = document.createElement('a-entity') as Entity;
    this.gameGroup.setAttribute('visible', false);
    this.root.appendChild(this.gameGroup);
    this.gameGroup.appendChild(this.createPlane(0, 0, UI.panelWidth, gamePanelHeight, UI.colors.panel, UI.z.panel, 0.96));

    const gameContentTop = gamePanelHeight / 2 - UI.padding;
    y = gameContentTop;

    this.instruction = new CanvasTextPanel({
      x: 0,
      y: y - UI.promptHeight / 2,
      z: UI.z.text,
      width: contentWidth - 0.22,
      height: UI.promptHeight - 0.1,
      color: UI.colors.textInverse,
    });
    this.gameGroup.appendChild(this.createPlane(0, y - UI.promptHeight / 2, contentWidth, UI.promptHeight, UI.colors.prompt, UI.z.row, 0.94));
    this.gameGroup.appendChild(this.instruction.entity);
    y -= UI.promptHeight + UI.gap;

    this.exitButton = this.createButtonRow({
      value: '__exit__',
      label: 'Exit game',
      x: 0,
      y: y - UI.replayHeight / 2,
      width: contentWidth,
      height: UI.replayHeight,
      selected: false,
      inverse: false,
      marker: false,
      onSelect: () => {
        if (this.state !== 'running') return;
        this.onExit();
        this.setState('pre-game');
      },
    });
    this.gameGroup.appendChild(this.exitButton.root);
    y -= UI.replayHeight + UI.gap;

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
      onSelect: () => void this.replayInstructionAudio(true),
    });
    this.gameGroup.appendChild(this.replayButton.root);
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
    this.gameGroup.appendChild(this.feedbackBackground);
    this.feedback.setAttribute('visible', false);
    this.gameGroup.appendChild(this.feedback);

    this.syncLanguageRows();
    this.setState('pre-game');
  }

  setInstruction(prompt: GlossPrompt): void {
    this.instruction.setText(prompt.text, this.selectedLanguage);
    this.audio.setSource(prompt.audioUrl);
    this.setRowEnabled(this.replayButton, this.audio.hasAudio());
    if (this.audio.isUnlocked()) void this.replayInstructionAudio(false);
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

  private setState(state: SceneUIState): void {
    this.state = state;
    const isPreGame = state === 'pre-game';
    this.startGroup.setAttribute('visible', isPreGame);
    this.gameGroup.setAttribute('visible', !isPreGame);
    this.clearFeedback();

    this.setRowEnabled(this.startButton, isPreGame);
    for (const row of this.languageRows.values()) {
      this.setRowEnabled(row, isPreGame);
    }
    this.setRowEnabled(this.exitButton, !isPreGame);
    this.setRowEnabled(this.replayButton, !isPreGame && this.audio.hasAudio());
  }

  private clearFeedback(): void {
    if (this.feedbackTimer !== null) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    this.feedbackBackground.setAttribute('visible', false);
    this.feedback.setAttribute('visible', false);
  }

  private async replayInstructionAudio(countAsReplay: boolean): Promise<void> {
    const played = await this.audio.replay();
    if (played && countAsReplay) this.onAudioReplay();
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
    const method = enabled ? 'add' : 'remove';
    row.root.classList[method]('ui-interactable');
    row.background.classList[method]('ui-interactable');
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

  private makeClickableLink(entity: Entity, width: number, height: number, url: string): void {
    entity.classList.add('ui-interactable');
    entity.setAttribute('geometry', { primitive: 'plane', width, height });
    entity.setAttribute('material', { color: '#ffffff', shader: 'flat', transparent: true, opacity: 0 });
    entity.addEventListener('click', () => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
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

class CanvasTextPanel {
  readonly entity: Entity;
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly color: string;

  constructor(opts: {
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    color: string;
  }) {
    this.color = opts.color;
    this.canvas.width = Math.round(opts.width * 512 * TEXTURE_SCALE);
    this.canvas.height = Math.round(opts.height * 512 * TEXTURE_SCALE);

    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not create instruction text canvas.');
    this.context = context;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(opts.width, opts.height), material);

    this.entity = document.createElement('a-entity') as Entity;
    this.entity.setAttribute('position', `${opts.x} ${opts.y} ${opts.z}`);
    this.entity.object3D.add(mesh);
    this.setText('', 'eng');
  }

  setText(text: string, language: LanguageCode): void {
    const direction = getTextDirection(language);
    const lines = this.layoutText(text, direction);
    const context = this.context;

    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.direction = direction;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = this.color;
    context.font = this.getFont(lines.fontSize);

    const lineHeight = lines.fontSize * 1.25;
    const totalHeight = lineHeight * lines.values.length;
    const firstBaseline = (this.canvas.height - totalHeight) / 2 + lineHeight / 2;
    const x = this.canvas.width / 2;

    lines.values.forEach((line, index) => {
      context.fillText(line, x, firstBaseline + index * lineHeight);
    });

    this.texture.needsUpdate = true;
  }

  private layoutText(text: string, direction: CanvasDirection): { values: string[]; fontSize: number } {
    const maxWidth = this.canvas.width * 0.9;
    const maxHeight = this.canvas.height * 0.86;
    const maxLines = 3;

    const minFontSize = Math.round(this.canvas.height * 0.12);
    for (let fontSize = Math.round(this.canvas.height * 0.34); fontSize >= minFontSize; fontSize -= 2) {
      this.context.font = this.getFont(fontSize);
      this.context.direction = direction;
      const lines = this.wrapText(text, maxWidth);
      if (lines.length <= maxLines && lines.length * fontSize * 1.25 <= maxHeight) {
        return { values: lines, fontSize };
      }
    }

    this.context.font = this.getFont(minFontSize);
    this.context.direction = direction;
    return { values: this.wrapText(text, maxWidth), fontSize: minFontSize };
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];

    const lines: string[] = [];
    let line = '';

    for (const word of words) {
      if (line === '') {
        line = this.fitWord(word, maxWidth, lines);
        continue;
      }

      const candidate = `${line} ${word}`;
      if (this.context.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }

      lines.push(line);
      line = this.fitWord(word, maxWidth, lines);
    }

    if (line !== '') lines.push(line);
    return lines;
  }

  private fitWord(word: string, maxWidth: number, lines: string[]): string {
    if (this.context.measureText(word).width <= maxWidth) return word;

    let line = '';
    for (const char of [...word]) {
      const candidate = `${line}${char}`;
      if (this.context.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line !== '') lines.push(line);
      line = char;
    }
    return line;
  }

  private getFont(fontSize: number): string {
    return `600 ${fontSize}px ${INSTRUCTION_FONT_FAMILY}`;
  }
}

function getTextDirection(language: LanguageCode): CanvasDirection {
  return language === 'arb' ? 'rtl' : 'ltr';
}
