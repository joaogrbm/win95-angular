import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../core/dialog/dialog.service';
import { WindowManagerService } from '../../core/window-manager.service';
import {
  FillMode,
  HistoryState,
  PaintTool,
  Point,
  PreviewShape,
  SelectionArea,
  clamp,
  createHistoryState,
  flipImageData,
  floodFill,
  hexToRgba,
  redoHistoryState,
  rotateImageData,
  toCanvasCoordinates,
  undoHistoryState,
} from './paint-utils';

const SHAPE_TOOLS: ReadonlyArray<PaintTool> = ['line', 'curve', 'rectangle', 'ellipse', 'rounded-rectangle'];
const FREEHAND_TOOLS: ReadonlyArray<PaintTool> = ['pencil', 'brush', 'eraser', 'airbrush'];
const CLICK_TOOLS: ReadonlyArray<PaintTool> = ['fill', 'picker', 'magnifier', 'text'];

@Component({
  selector: 'app-paint',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paint.component.html',
  styleUrls: ['./paint.component.scss'],
})
export class PaintComponent implements AfterViewInit, OnDestroy {
  private windowManager = inject(WindowManagerService);
  private dialog = inject(DialogService);

  @ViewChild('paintCanvas') paintCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('paintFileInput') paintFileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('paintCanvasPanel') paintCanvasPanelRef?: ElementRef<HTMLElement>;

  readonly paintTools: ReadonlyArray<{ id: PaintTool; label: string; icon: string }> = [
    { id: 'free-select', label: 'Free-form selection', icon: 'F' },
    { id: 'rect-select', label: 'Rectangular selection', icon: 'R' },
    { id: 'eraser', label: 'Eraser', icon: 'E' },
    { id: 'fill', label: 'Fill', icon: 'B' },
    { id: 'picker', label: 'Color picker', icon: 'P' },
    { id: 'magnifier', label: 'Magnifier', icon: 'M' },
    { id: 'pencil', label: 'Pencil', icon: 'P' },
    { id: 'brush', label: 'Brush', icon: 'U' },
    { id: 'airbrush', label: 'Airbrush', icon: 'A' },
    { id: 'text', label: 'Text', icon: 'T' },
    { id: 'line', label: 'Line', icon: 'L' },
    { id: 'curve', label: 'Curve', icon: 'C' },
    { id: 'rectangle', label: 'Rectangle', icon: '◫' },
    { id: 'polygon', label: 'Polygon', icon: '▱' },
    { id: 'ellipse', label: 'Ellipse', icon: '◯' },
    { id: 'rounded-rectangle', label: 'Rounded rectangle', icon: '◭' },
  ];

  readonly paintPalette = [
    '#000000', '#FFFFFF', '#808080', '#C0C0C0', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080',
    '#FF8040', '#804000', '#408080', '#D8D8D8', '#004080', '#80FF80', '#80C0FF', '#FF8080',
  ];

  readonly paintFillModes: ReadonlyArray<{ value: FillMode; label: string }> = [
    { value: 'outline', label: 'Outline' },
    { value: 'filled', label: 'Filled' },
    { value: 'outline-filled', label: 'Outline + fill' },
  ];

  paintTool = signal<PaintTool>('pencil');
  primaryColor = signal('#000000');
  secondaryColor = signal('#FFFFFF');
  strokeWidth = signal(1);
  fillStyle = signal<FillMode>('outline');
  paintZoom = signal(1);
  paintFileName = signal('untitled');
  paintUnsaved = signal(false);
  paintShowToolbox = signal(true);
  paintShowPalette = signal(true);
  paintShowStatus = signal(true);
  paintPointer = signal<Point>({ x: 0, y: 0 });
  paintStatusText = signal('Use the pencil to draw.');
  paintDocumentWidth = signal(600);
  paintDocumentHeight = signal(400);
  paintSelection = signal<SelectionArea | null>(null);
  paintHistory = signal<HistoryState[]>([]);
  paintHistoryFuture = signal<HistoryState[]>([]);
  clipboardImage: ImageData | null = null;

  private paintBaseCanvas: HTMLCanvasElement = document.createElement('canvas');
  private paintIsDrawing = false;
  private paintLastPoint: Point | null = null;
  private paintPreview: PreviewShape | null = null;
  private paintPolygonPoints: Point[] = [];
  private paintSelectionStart: Point | null = null;
  // cor do traço atual (primária com botão esquerdo, secundária com o direito) e a outra cor
  private paintActiveColor = '#000000';
  private paintAltColor = '#FFFFFF';
  private paintPanelObserver?: ResizeObserver;

  readonly paintTitle = computed(() => `${this.paintFileName()}${this.paintUnsaved() ? '*' : ''} - Paint`);
  readonly paintSelectionText = computed(() => {
    const selection = this.paintSelection();
    if (!selection) {
      return '';
    }
    return `${Math.max(1, selection.width)} x ${Math.max(1, selection.height)}`;
  });

  constructor() {
    this.paintNewDocument();
    // o título mostra "*" enquanto houver alterações não salvas
    effect(() => this.windowManager.setTitle('paint', this.paintTitle()));
    this.windowManager.setCloseGuard('paint', () => this.paintConfirmClose());
  }

  ngAfterViewInit(): void {
    this.paintBindCanvas();
    this.paintRender();

    const panel = this.paintCanvasPanelRef?.nativeElement;
    if (panel) {
      this.paintPanelObserver = new ResizeObserver(() => this.paintFitToPanel());
      this.paintPanelObserver.observe(panel);
    }
  }

  ngOnDestroy(): void {
    this.paintPanelObserver?.disconnect();
    this.windowManager.setCloseGuard('paint', null);
  }

  // Pergunta se quer salvar antes de fechar. Retorna false se o usuário cancelar.
  private async paintConfirmClose(): Promise<boolean> {
    if (!this.paintUnsaved()) {
      return true;
    }

    const answer = await this.dialog.ask({
      title: 'Paint',
      icon: 'warning',
      message: `Salvar alterações em ${this.paintFileName()}?`,
      buttons: ['Sim', 'Não', 'Cancelar'],
    });

    if (answer === 'Sim') {
      this.paintSaveFile();
      return true;
    }
    return answer === 'Não';
  }

  // Com a janela maximizada, aumenta a imagem para preencher o painel.
  // Nunca diminui, para não cortar o que já foi desenhado.
  private paintFitToPanel(): void {
    const panel = this.paintCanvasPanelRef?.nativeElement;
    if (!panel || !this.windowManager.getWindow('paint')?.isMaximized) {
      return;
    }

    // padding do painel (4px de cada lado) + borda do wrapper (2px de cada lado)
    const frame = 12;
    const zoom = this.paintZoom();
    const width = Math.max(this.paintDocumentWidth(), Math.floor((panel.clientWidth - frame) / zoom));
    const height = Math.max(this.paintDocumentHeight(), Math.floor((panel.clientHeight - frame) / zoom));
    if (width === this.paintDocumentWidth() && height === this.paintDocumentHeight()) {
      return;
    }

    const expanded = document.createElement('canvas');
    expanded.width = width;
    expanded.height = height;
    const context = expanded.getContext('2d');
    if (!context) {
      return;
    }
    context.drawImage(this.paintBaseCanvas, 0, 0);
    this.paintSetImage(context.getImageData(0, 0, width, height));
  }

  private paintBindCanvas(): void {
    const canvas = this.paintCanvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    this.paintBaseCanvas.width = this.paintDocumentWidth();
    this.paintBaseCanvas.height = this.paintDocumentHeight();
    canvas.width = this.paintDocumentWidth() * this.paintZoom();
    canvas.height = this.paintDocumentHeight() * this.paintZoom();
    canvas.style.width = `${this.paintDocumentWidth() * this.paintZoom()}px`;
    canvas.style.height = `${this.paintDocumentHeight() * this.paintZoom()}px`;
  }

  private paintCreateBlankImageData(width: number, height: number): ImageData {
    const blank = new ImageData(width, height);
    for (let index = 0; index < blank.data.length; index += 4) {
      blank.data[index + 3] = 0;
    }
    return blank;
  }

  private paintSetImage(image: ImageData): void {
    const context = this.paintBaseCanvas.getContext('2d');
    if (!context) {
      return;
    }
    this.paintBaseCanvas.width = image.width;
    this.paintBaseCanvas.height = image.height;
    this.paintDocumentWidth.set(image.width);
    this.paintDocumentHeight.set(image.height);
    context.putImageData(image, 0, 0);
    this.paintRender();
  }

  private paintGetImage(): ImageData {
    const context = this.paintBaseCanvas.getContext('2d');
    return context?.getImageData(0, 0, this.paintBaseCanvas.width, this.paintBaseCanvas.height)
      ?? this.paintCreateBlankImageData(this.paintDocumentWidth(), this.paintDocumentHeight());
  }

  private paintPushHistory(label: string): void {
    const image = this.paintGetImage();
    const snapshot = createHistoryState(image, label);
    const priorHistory = this.paintHistory();
    const maxHistory = 30;
    const trimmedHistory = priorHistory.slice(Math.max(0, priorHistory.length - maxHistory + 1));
    const nextHistory = [...trimmedHistory, snapshot];
    this.paintHistory.set(nextHistory);
    this.paintHistoryFuture.set([]);
    this.paintUnsaved.set(true);
  }

  private paintRender(): void {
    const canvas = this.paintCanvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const width = this.paintDocumentWidth() * this.paintZoom();
    const height = this.paintDocumentHeight() * this.paintZoom();
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = false;
    context.drawImage(this.paintBaseCanvas, 0, 0, width, height);

    if (this.paintPreview) {
      this.paintDrawPreview(context);
    }

    const selection = this.paintSelection();
    if (selection) {
      context.save();
      context.strokeStyle = '#000000';
      context.setLineDash([4, 3]);
      context.lineWidth = 1;
      const sx = selection.x * this.paintZoom();
      const sy = selection.y * this.paintZoom();
      const sw = Math.max(1, selection.width * this.paintZoom());
      const sh = Math.max(1, selection.height * this.paintZoom());
      context.strokeRect(sx, sy, sw, sh);
      context.restore();
    }
  }

  private paintDrawPreview(context: CanvasRenderingContext2D): void {
    if (!this.paintPreview) {
      return;
    }

    context.save();
    context.scale(this.paintZoom(), this.paintZoom());
    this.paintDrawShape(context, this.paintPreview);
    context.restore();
  }

  // Desenha a forma em coordenadas da imagem. É usada tanto na prévia quanto
  // no resultado final, para que os dois fiquem idênticos.
  private paintDrawShape(context: CanvasRenderingContext2D, shape: PreviewShape): void {
    const { start, end } = shape;
    const fillMode = this.fillStyle();
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.max(1, Math.abs(end.x - start.x));
    const height = Math.max(1, Math.abs(end.y - start.y));

    context.strokeStyle = this.paintActiveColor;
    context.fillStyle = fillMode === 'outline-filled' ? this.paintAltColor : this.paintActiveColor;
    context.lineWidth = this.strokeWidth();
    context.lineJoin = 'round';
    context.lineCap = 'round';

    const path = new Path2D();
    let closed = true;
    switch (shape.tool) {
      case 'line':
        path.moveTo(start.x, start.y);
        path.lineTo(end.x, end.y);
        closed = false;
        break;
      case 'curve':
        path.moveTo(start.x, start.y);
        path.quadraticCurveTo(start.x + (end.x - start.x) / 2, start.y - 40, end.x, end.y);
        closed = false;
        break;
      case 'rectangle':
        path.rect(left, top, width, height);
        break;
      case 'ellipse':
        path.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        break;
      case 'rounded-rectangle':
        path.roundRect(left, top, width, height, Math.min(20, Math.max(5, Math.min(width, height) / 5)));
        break;
      default:
        return;
    }

    if (closed && fillMode !== 'outline') {
      context.fill(path);
    }
    if (!closed || fillMode !== 'filled') {
      context.stroke(path);
    }
  }

  private paintDrawStroke(start: Point, end: Point, color: string, erase = false): void {
    const context = this.paintBaseCanvas.getContext('2d');
    if (!context) {
      return;
    }

    const width = this.strokeWidth();
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    if (erase) {
      context.globalCompositeOperation = 'destination-out';
      context.strokeStyle = 'rgba(0,0,0,1)';
    }
    context.stroke();
    context.globalCompositeOperation = 'source-over';
  }

  private paintDrawBrush(start: Point, end: Point, color: string, erase = false): void {
    const context = this.paintBaseCanvas.getContext('2d');
    if (!context) {
      return;
    }

    const radius = Math.max(1, this.strokeWidth() / 2);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const steps = Math.ceil(distance);

    for (let step = 0; step <= steps; step += 1) {
      const x = Math.round(start.x + (dx * step) / steps);
      const y = Math.round(start.y + (dy * step) / steps);
      context.beginPath();
      context.fillStyle = color;
      context.arc(x, y, radius, 0, Math.PI * 2);
      if (erase) {
        context.globalCompositeOperation = 'destination-out';
      }
      context.fill();
      context.globalCompositeOperation = 'source-over';
    }
  }

  private paintDrawAirbrush(point: Point, color: string): void {
    const context = this.paintBaseCanvas.getContext('2d');
    if (!context) {
      return;
    }

    for (let step = 0; step < 15; step += 1) {
      const offsetX = Math.random() * 14 - 7;
      const offsetY = Math.random() * 14 - 7;
      const x = clamp(Math.round(point.x + offsetX), 0, this.paintDocumentWidth() - 1);
      const y = clamp(Math.round(point.y + offsetY), 0, this.paintDocumentHeight() - 1);
      context.fillStyle = color;
      context.fillRect(x, y, 1, 1);
    }
  }

  private paintSetPixel(x: number, y: number, color: string, alpha = 255): void {
    const context = this.paintBaseCanvas.getContext('2d');
    if (!context) {
      return;
    }

    const image = context.getImageData(0, 0, this.paintBaseCanvas.width, this.paintBaseCanvas.height);
    const index = (y * image.width + x) * 4;
    const [r, g, b] = hexToRgba(color);
    image.data[index] = r;
    image.data[index + 1] = g;
    image.data[index + 2] = b;
    image.data[index + 3] = alpha;
    context.putImageData(image, 0, 0);
  }

  private paintToolActivated(point: Point, button: number): void {
    const tool = this.paintTool();
    const selectedColor = button === 2 ? this.secondaryColor() : this.primaryColor();

    if (tool === 'picker') {
      const context = this.paintBaseCanvas.getContext('2d');
      if (!context) {
        return;
      }

      const pixel = context.getImageData(point.x, point.y, 1, 1).data;
      const color = `#${[pixel[0], pixel[1], pixel[2]].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
      if (button === 2) {
        this.secondaryColor.set(color);
      } else {
        this.primaryColor.set(color);
      }
      return;
    }

    if (tool === 'fill') {
      const image = this.paintGetImage();
      const filledImage = floodFill(image, point.x, point.y, selectedColor);
      this.paintSetImage(filledImage);
      this.paintPushHistory('fill');
      this.paintStatusText.set('Filled the selected region.');
      return;
    }

    if (tool === 'magnifier') {
      // botão esquerdo aproxima, direito afasta
      const step = button === 2 ? -0.5 : 0.5;
      const nextZoom = clamp(this.paintZoom() + step, 0.5, 6);
      this.paintZoom.set(nextZoom);
      this.paintRender();
      this.paintFitToPanel();
      this.paintStatusText.set(`Zoom ${nextZoom.toFixed(1)}x`);
      return;
    }

    if (tool === 'text') {
      const value = prompt('Text to insert');
      if (!value) {
        return;
      }
      const context = this.paintBaseCanvas.getContext('2d');
      if (!context) {
        return;
      }
      context.font = `${this.strokeWidth() * 8}px MS Sans Serif, Tahoma, sans-serif`;
      context.fillStyle = selectedColor;
      context.fillText(value, point.x, point.y + 10);
      this.paintPushHistory('text');
      this.paintStatusText.set('Inserted text.');
      return;
    }

  }

  private paintCompleteShapeOperation(): void {
    const context = this.paintBaseCanvas.getContext('2d');
    if (!this.paintPreview || !context) {
      return;
    }

    this.paintDrawShape(context, this.paintPreview);
    this.paintPreview = null;
    this.paintPushHistory('shape');
    this.paintStatusText.set('Shape committed to the canvas.');
    this.paintRender();
  }

  // Retangular: do ponto inicial até o mouse. Livre: caixa que envolve todo o caminho percorrido.
  private paintUpdateSelection(point: Point): void {
    const start = this.paintSelectionStart;
    if (!start) {
      return;
    }

    let left = Math.min(start.x, point.x);
    let top = Math.min(start.y, point.y);
    let right = Math.max(start.x, point.x);
    let bottom = Math.max(start.y, point.y);

    const current = this.paintSelection();
    if (this.paintTool() === 'free-select' && current) {
      left = Math.min(left, current.x);
      top = Math.min(top, current.y);
      right = Math.max(right, current.x + current.width);
      bottom = Math.max(bottom, current.y + current.height);
    }

    this.paintSelection.set({ x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) });
  }

  private paintApplySelectionOperation(action: 'cut' | 'copy' | 'paste' | 'delete'): void {
    const currentSelection = this.paintSelection();
    if (!currentSelection && action !== 'paste') {
      return;
    }

    if (action === 'copy') {
      const crop = this.paintBaseCanvas.getContext('2d')!.getImageData(currentSelection!.x, currentSelection!.y, currentSelection!.width, currentSelection!.height);
      this.clipboardImage = crop;
      this.paintStatusText.set('Selection copied.');
      return;
    }

    if (action === 'cut') {
      const crop = this.paintBaseCanvas.getContext('2d')!.getImageData(currentSelection!.x, currentSelection!.y, currentSelection!.width, currentSelection!.height);
      this.clipboardImage = crop;
      const ctx = this.paintBaseCanvas.getContext('2d')!;
      ctx.clearRect(currentSelection!.x, currentSelection!.y, currentSelection!.width, currentSelection!.height);
      this.paintPushHistory('cut');
      this.paintStatusText.set('Selection cut.');
      return;
    }

    if (action === 'delete') {
      const ctx = this.paintBaseCanvas.getContext('2d')!;
      ctx.clearRect(currentSelection!.x, currentSelection!.y, currentSelection!.width, currentSelection!.height);
      this.paintPushHistory('delete');
      this.paintSelection.set(null);
      this.paintStatusText.set('Selection deleted.');
      return;
    }

    if (action === 'paste' && this.clipboardImage) {
      const context = this.paintBaseCanvas.getContext('2d');
      if (!context) {
        return;
      }
      const pointer = this.paintPointer();
      context.putImageData(this.clipboardImage, pointer.x, pointer.y);
      this.paintPushHistory('paste');
      this.paintStatusText.set('Selection pasted.');
    }
  }

  paintNewDocument(): void {
    const blank = this.paintCreateBlankImageData(this.paintDocumentWidth(), this.paintDocumentHeight());
    this.paintSetImage(blank);
    this.paintSelection.set(null);
    this.paintPreview = null;
    this.paintFileName.set('untitled');
    this.paintUnsaved.set(false);
    this.paintHistory.set([createHistoryState(blank, 'new document')]);
    this.paintHistoryFuture.set([]);
    this.paintStatusText.set('New document created.');
    this.updatePaintWindowTitle();
  }

  updatePaintWindowTitle(): void {
    this.windowManager.setTitle('paint', this.paintTitle());
  }

  selectPaintTool(tool: PaintTool): void {
    this.paintTool.set(tool);
    this.paintStatusText.set(this.paintToolHelp(tool));
  }

  private paintToolHelp(tool: PaintTool): string {
    const map: Record<PaintTool, string> = {
      'free-select': 'Drag to define a free-form selection.',
      'rect-select': 'Drag to define a rectangular selection.',
      eraser: 'Erase pixels and restore transparency.',
      fill: 'Click any enclosed area to fill it.',
      picker: 'Pick a color from the canvas.',
      magnifier: 'Left click to zoom in, right click to zoom out.',
      pencil: 'Use the pencil to draw with a one-pixel stroke.',
      brush: 'Use the brush to paint with a rounded tip.',
      airbrush: 'Spray random points around the cursor.',
      text: 'Click to place text on the canvas.',
      line: 'Drag to draw a line.',
      curve: 'Drag to draw a curve.',
      rectangle: 'Drag to create a rectangle.',
      polygon: 'Click points to build a polygon, then double-click to finish.',
      ellipse: 'Drag to create an ellipse.',
      'rounded-rectangle': 'Drag to create a rounded rectangle.',
    };

    return map[tool] ?? 'Use the selected tool.';
  }

  setPaintPaletteColor(color: string, button: 0 | 2): void {
    if (button === 2) {
      this.secondaryColor.set(color);
    } else {
      this.primaryColor.set(color);
    }
  }

  paintToggleToolbox(): void {
    this.paintShowToolbox.update(v => !v);
  }

  paintTogglePalette(): void {
    this.paintShowPalette.update(v => !v);
  }

  paintToggleStatus(): void {
    this.paintShowStatus.update(v => !v);
  }

  paintChangeZoom(factor: number): void {
    this.paintZoom.set(clamp(Number((this.paintZoom() * factor).toFixed(2)), 0.5, 6));
    this.paintRender();
    this.paintFitToPanel();
  }

  paintUndo(): void {
    const current = this.paintHistory();
    const future = this.paintHistoryFuture();
    const snapshot = undoHistoryState(current, future);
    if (snapshot.history.length === current.length) {
      return;
    }

    this.paintHistory.set(snapshot.history);
    this.paintHistoryFuture.set(snapshot.future);
    const restored = snapshot.history[snapshot.history.length - 1];
    if (restored) {
      this.paintSetImage(restored.image);
    }
    this.paintFitToPanel();
    this.paintSelection.set(null);
    this.paintUnsaved.set(this.paintHistory().length > 0);
  }

  paintRedo(): void {
    const current = this.paintHistory();
    const future = this.paintHistoryFuture();
    const snapshot = redoHistoryState(current, future);
    if (snapshot.history.length === current.length) {
      return;
    }

    this.paintHistory.set(snapshot.history);
    this.paintHistoryFuture.set(snapshot.future);
    const restored = snapshot.history[snapshot.history.length - 1];
    if (restored) {
      this.paintSetImage(restored.image);
    }
    this.paintFitToPanel();
    this.paintSelection.set(null);
    this.paintUnsaved.set(this.paintHistory().length > 0);
  }

  paintSaveFile(): void {
    const canvas = document.createElement('canvas');
    canvas.width = this.paintBaseCanvas.width;
    canvas.height = this.paintBaseCanvas.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.drawImage(this.paintBaseCanvas, 0, 0);

    const link = document.createElement('a');
    link.download = `${this.paintFileName()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    this.paintUnsaved.set(false);
    this.updatePaintWindowTitle();
  }

  paintExportPng(): void {
    this.paintSaveFile();
  }

  paintOpenImage(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (!context) {
          return;
        }
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        this.paintDocumentWidth.set(image.width);
        this.paintDocumentHeight.set(image.height);
        this.paintSetImage(imageData);
        this.paintFileName.set(file.name.replace(/\.[^/.]+$/, '') || 'untitled');
        this.paintUnsaved.set(false);
        this.updatePaintWindowTitle();
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  paintOnFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.paintOpenImage(file);
      input.value = '';
    }
  }

  paintTriggerOpenDialog(): void {
    this.paintFileInputRef?.nativeElement.click();
  }

  paintResizeImage(): void {
    const width = Number(prompt('Width', `${this.paintDocumentWidth()}`));
    const height = Number(prompt('Height', `${this.paintDocumentHeight()}`));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }

    const resized = document.createElement('canvas');
    resized.width = width;
    resized.height = height;
    const context = resized.getContext('2d');
    if (!context) {
      return;
    }
    context.clearRect(0, 0, width, height);
    context.drawImage(this.paintBaseCanvas, 0, 0, width, height);
    this.paintDocumentWidth.set(width);
    this.paintDocumentHeight.set(height);
    this.paintSetImage(context.getImageData(0, 0, width, height));
    this.paintPushHistory('resize');
  }

  paintRotateImage(angle: number): void {
    const rotated = rotateImageData(this.paintGetImage(), angle);
    this.paintSetImage(rotated);
    this.paintPushHistory(`rotate ${angle}`);
  }

  paintFlipImage(horizontal: boolean): void {
    const flipped = flipImageData(this.paintGetImage(), horizontal);
    this.paintSetImage(flipped);
    this.paintPushHistory(horizontal ? 'flip horizontal' : 'flip vertical');
  }

  paintClearImage(): void {
    if (!confirm('Clear the whole image?')) {
      return;
    }
    const blank = this.paintCreateBlankImageData(this.paintDocumentWidth(), this.paintDocumentHeight());
    this.paintSetImage(blank);
    this.paintPushHistory('clear');
  }

  paintPointerDown(event: PointerEvent): void {
    const canvas = this.paintCanvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const point = toCanvasCoordinates(event.clientX, event.clientY, canvas, this.paintZoom());
    const tool = this.paintTool();
    this.paintPointer.set(point);

    if (CLICK_TOOLS.includes(tool)) {
      this.paintToolActivated(point, event.button);
      return;
    }

    this.paintIsDrawing = true;
    canvas.setPointerCapture(event.pointerId);
    this.paintLastPoint = point;

    const isSecondary = event.button === 2;
    this.paintActiveColor = isSecondary ? this.secondaryColor() : this.primaryColor();
    this.paintAltColor = isSecondary ? this.primaryColor() : this.secondaryColor();

    switch (tool) {
      case 'pencil':
        this.paintDrawStroke(point, point, this.paintActiveColor);
        this.paintStatusText.set('Drawing on the canvas.');
        break;
      case 'brush':
        this.paintDrawBrush(point, point, this.paintActiveColor);
        break;
      case 'eraser':
        this.paintDrawStroke(point, point, '#000000', true);
        break;
      case 'airbrush':
        this.paintDrawAirbrush(point, this.paintActiveColor);
        break;
      case 'rect-select':
      case 'free-select':
        this.paintSelectionStart = point;
        this.paintSelection.set({ x: point.x, y: point.y, width: 1, height: 1 });
        break;
      default:
        if (SHAPE_TOOLS.includes(tool)) {
          this.paintPreview = { tool, start: point, end: point };
          this.paintStatusText.set(this.paintToolHelp(tool));
        }
    }

    this.paintRender();
  }

  paintPointerMove(event: PointerEvent): void {
    const canvas = this.paintCanvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    const point = toCanvasCoordinates(event.clientX, event.clientY, canvas, this.paintZoom());
    this.paintPointer.set(point);

    if (!this.paintIsDrawing) {
      this.paintStatusText.set(this.paintToolHelp(this.paintTool()));
      return;
    }

    const last = this.paintLastPoint ?? point;
    switch (this.paintTool()) {
      case 'pencil':
        this.paintDrawStroke(last, point, this.paintActiveColor);
        break;
      case 'brush':
        this.paintDrawBrush(last, point, this.paintActiveColor);
        break;
      case 'eraser':
        this.paintDrawStroke(last, point, '#000000', true);
        break;
      case 'airbrush':
        this.paintDrawAirbrush(point, this.paintActiveColor);
        break;
      case 'rect-select':
      case 'free-select':
        this.paintUpdateSelection(point);
        break;
      default:
        if (this.paintPreview) {
          this.paintPreview.end = point;
        }
    }

    this.paintLastPoint = point;
    this.paintRender();
  }

  paintPointerUp(event: PointerEvent): void {
    const canvas = this.paintCanvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    if (this.paintIsDrawing) {
      const tool = this.paintTool();
      // o histórico guarda o estado depois de cada ação, então só salva quando o traço termina
      if (FREEHAND_TOOLS.includes(tool)) {
        this.paintPushHistory(tool);
      } else if (this.paintPreview) {
        this.paintCompleteShapeOperation();
      }
    }

    this.paintIsDrawing = false;
    this.paintLastPoint = null;
    this.paintPreview = null;
    this.paintSelectionStart = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    this.paintRender();
  }

  paintOnContextMenu(event: MouseEvent): boolean {
    event.preventDefault();
    return false;
  }

  paintCutSelection(): void {
    this.paintApplySelectionOperation('cut');
  }

  paintCopySelection(): void {
    this.paintApplySelectionOperation('copy');
  }

  paintPasteSelection(): void {
    this.paintApplySelectionOperation('paste');
  }

  paintDeleteSelection(): void {
    this.paintApplySelectionOperation('delete');
  }

  paintSelectAll(): void {
    this.paintSelection.set({ x: 0, y: 0, width: this.paintDocumentWidth(), height: this.paintDocumentHeight() });
  }
}
