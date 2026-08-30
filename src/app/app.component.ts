import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild, computed, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';

export interface WindowItem {
  id: string;
  title: string;
  icon: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  folderId?: string | null;
}

export interface VirtualFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: string[];
  parentId: 'desktop' | string;
}

export type PaintTool =
  | 'free-select'
  | 'rect-select'
  | 'eraser'
  | 'fill'
  | 'picker'
  | 'magnifier'
  | 'pencil'
  | 'brush'
  | 'airbrush'
  | 'text'
  | 'line'
  | 'curve'
  | 'rectangle'
  | 'polygon'
  | 'ellipse'
  | 'rounded-rectangle';

export type FillMode = 'outline' | 'filled' | 'outline-filled';

export interface Point {
  x: number;
  y: number;
}

export interface HistoryState {
  id: string;
  label: string;
  image: ImageData;
}

export interface SelectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreviewShape {
  tool: PaintTool;
  start: Point;
  end: Point;
}

export function createHistoryState(image: ImageData, label = 'action'): HistoryState {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label,
    image: new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
  };
}

export function undoHistoryState(history: HistoryState[], future: HistoryState[]) {
  if (history.length === 0) {
    return { history: [], future, current: null };
  }

  const current = history[history.length - 1];
  return {
    history: history.slice(0, -1),
    future: [current, ...future],
    current: history[history.length - 2] ?? null,
  };
}

export function redoHistoryState(history: HistoryState[], future: HistoryState[]) {
  if (future.length === 0) {
    return { history, future, current: history[history.length - 1] ?? null };
  }

  const [next, ...remaining] = future;
  return {
    history: [...history, next],
    future: remaining,
    current: next,
  };
}

export function toCanvasCoordinates(clientX: number, clientY: number, canvas: HTMLCanvasElement, zoomLevel: number): Point {
  const rect = canvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(canvas.width / zoomLevel, (clientX - rect.left) / zoomLevel));
  const y = Math.max(0, Math.min(canvas.height / zoomLevel, (clientY - rect.top) / zoomLevel));
  return { x: Math.floor(x), y: Math.floor(y) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hexToRgba(hex: string): [number, number, number, number] {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const asNumber = Number.parseInt(expanded, 16);
  return [
    (asNumber >> 16) & 255,
    (asNumber >> 8) & 255,
    asNumber & 255,
    255,
  ];
}

export function floodFill(image: ImageData, x: number, y: number, fillColor: string): ImageData {
  const result = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const fill = hexToRgba(fillColor);

  if (x < 0 || y < 0 || x >= result.width || y >= result.height) {
    return result;
  }

  const targetIndex = (y * result.width + x) * 4;
  const targetColor = [
    result.data[targetIndex],
    result.data[targetIndex + 1],
    result.data[targetIndex + 2],
    result.data[targetIndex + 3],
  ];

  const stack: Array<[number, number]> = [[x, y]];

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= result.width || cy >= result.height) {
      continue;
    }

    const index = (cy * result.width + cx) * 4;
    const current = [
      result.data[index],
      result.data[index + 1],
      result.data[index + 2],
      result.data[index + 3],
    ];

    if (
      current[0] !== targetColor[0] ||
      current[1] !== targetColor[1] ||
      current[2] !== targetColor[2] ||
      current[3] !== targetColor[3]
    ) {
      continue;
    }

    result.data[index] = fill[0];
    result.data[index + 1] = fill[1];
    result.data[index + 2] = fill[2];
    result.data[index + 3] = fill[3];

    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }

  return result;
}

export function rotateImageData(image: ImageData, angle: number): ImageData {
  const normalized = ((angle % 360) + 360) % 360;
  const width = image.width;
  const height = image.height;

  if (normalized === 0) {
    return new ImageData(new Uint8ClampedArray(image.data), width, height);
  }

  if (normalized === 90 || normalized === 270) {
    const next = new ImageData(height, width);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceIndex = (y * width + x) * 4;
        const targetX = normalized === 90 ? height - 1 - y : y;
        const targetY = normalized === 90 ? x : width - 1 - x;
        const targetIndex = (targetY * height + targetX) * 4;

        next.data[targetIndex] = image.data[sourceIndex];
        next.data[targetIndex + 1] = image.data[sourceIndex + 1];
        next.data[targetIndex + 2] = image.data[sourceIndex + 2];
        next.data[targetIndex + 3] = image.data[sourceIndex + 3];
      }
    }

    return next;
  }

  const next = new ImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = (y * width + x) * 4;
      const targetIndex = ((height - 1 - y) * width + (width - 1 - x)) * 4;
      next.data[targetIndex] = image.data[sourceIndex];
      next.data[targetIndex + 1] = image.data[sourceIndex + 1];
      next.data[targetIndex + 2] = image.data[sourceIndex + 2];
      next.data[targetIndex + 3] = image.data[sourceIndex + 3];
    }
  }

  return next;
}

export function flipImageData(image: ImageData, horizontal: boolean): ImageData {
  const result = new ImageData(image.width, image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const srcIndex = (y * image.width + x) * 4;
      const targetX = horizontal ? image.width - 1 - x : x;
      const targetY = horizontal ? y : image.height - 1 - y;
      const targetIndex = (targetY * image.width + targetX) * 4;
      result.data[targetIndex] = image.data[srcIndex];
      result.data[targetIndex + 1] = image.data[srcIndex + 1];
      result.data[targetIndex + 2] = image.data[srcIndex + 2];
      result.data[targetIndex + 3] = image.data[srcIndex + 3];
    }
  }

  return result;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DragDropModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {
  @ViewChild('paintCanvas') paintCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('paintFileInput') paintFileInputRef?: ElementRef<HTMLInputElement>;

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

  private topZIndex = 10;
  currentTime: Date = new Date();
  isStartMenuOpen = signal<boolean>(false);

  windows = signal<WindowItem[]>([
    { id: 'computer', title: 'Meu Computador', icon: 'my-computer.png', isOpen: true, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'trash', title: 'Lixeira', icon: 'recycle-bin.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'paint', title: 'untitled - Paint', icon: 'pbrush_1.ico', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'notepad', title: 'Bloco de Notas', icon: 'notepad.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'explorer', title: 'Explorador', icon: 'folder.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1, folderId: null },
    { id: 'internet-explorer', title: 'Internet Explorer', icon: 'folder.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'calculator', title: 'Calculadora', icon: 'calculator.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 }
  ]);

  files = signal<VirtualFile[]>([
    { id: 'txt-1', name: 'LEIA-ME.txt', type: 'file', content: 'Bem-vindo ao Windows 95!', parentId: 'desktop' },
    { id: 'fold-1', name: 'Meus Documentos', type: 'folder', children: ['txt-interno'], parentId: 'desktop' },
    { id: 'txt-interno', name: 'Segredo.txt', type: 'file', content: 'Você achou este arquivo dentro da pasta!', parentId: 'fold-1' }
  ]);

  desktopItems = computed(() => this.files().filter(f => f.parentId === 'desktop'));
  activeFileId = signal<string | null>(null);
  notepadFileName = signal<string>('Sem título.txt');
  notepadTextArea = signal<string>('');
  openWindows = computed(() => this.windows().filter(w => w.isOpen));

  activeWindowId = computed(() => {
    const visibleWindows = this.windows().filter(w => w.isOpen && !w.isMinimized);
    if (visibleWindows.length === 0) return null;
    const active = visibleWindows.reduce((prev, current) => (prev.zIndex > current.zIndex) ? prev : current);
    return active.id;
  });

  browserAddress = signal<string>('https://www.example.com');
  browserUrl = signal<string>('https://www.example.com');
  browserHistory = signal<string[]>(['https://www.example.com']);
  browserHistoryIndex = signal<number>(0);
  browserReloadToken = signal<number>(0);
  browserSrc = computed(() => this.buildBrowserSrc(this.browserUrl(), this.browserReloadToken()));
  browserSafeSrc = computed<SafeResourceUrl>(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.browserSrc()));

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

  readonly paintTitle = computed(() => `${this.paintFileName()}${this.paintUnsaved() ? '*' : ''} - Paint`);
  readonly paintSelectionText = computed(() => {
    const selection = this.paintSelection();
    if (!selection) {
      return '';
    }
    return `${Math.max(1, selection.width)} x ${Math.max(1, selection.height)}`;
  });

  contextMenu = signal<{ isOpen: boolean; x: number; y: number }>({ isOpen: false, x: 0, y: 0 });

  constructor(private sanitizer: DomSanitizer) {
    this.paintNewDocument();
  }

  ngAfterViewInit(): void {
    this.paintBindCanvas();
    this.paintRender();
  }

  private buildBrowserSrc(url: string, token: number): string {
    try {
      const parsed = new URL(url);
      const separator = parsed.search ? '&' : '?';
      return `${parsed.toString()}${separator}_=${token}`;
    } catch {
      return url;
    }
  }

  private normalizeUrl(value: string): string {
    let raw = value.trim();
    if (!raw) {
      return 'https://www.example.com';
    }

    if (!/^https?:\/\//i.test(raw)) {
      raw = `https://${raw}`;
    }

    try {
      return new URL(raw).toString();
    } catch {
      return raw;
    }
  }

  private pushBrowserHistory(url: string) {
    const currentIndex = this.browserHistoryIndex();
    const currentHistory = this.browserHistory();
    const normalized = this.normalizeUrl(url);

    if (currentHistory[currentIndex] === normalized) {
      return;
    }

    const nextHistory = currentHistory.slice(0, currentIndex + 1);
    nextHistory.push(normalized);
    this.browserHistory.set(nextHistory);
    this.browserHistoryIndex.set(nextHistory.length - 1);
  }

  navigateBrowser(): void {
    const url = this.normalizeUrl(this.browserAddress());
    this.browserUrl.set(url);
    this.browserAddress.set(url);
    this.pushBrowserHistory(url);
  }

  goHomeBrowser(): void {
    const homeUrl = 'https://www.example.com';
    this.browserUrl.set(homeUrl);
    this.browserAddress.set(homeUrl);
    this.pushBrowserHistory(homeUrl);
  }

  goBackBrowser(): void {
    if (this.browserHistoryIndex() <= 0) return;
    const previousIndex = this.browserHistoryIndex() - 1;
    const previousUrl = this.browserHistory()[previousIndex];
    this.browserHistoryIndex.set(previousIndex);
    this.browserUrl.set(previousUrl);
    this.browserAddress.set(previousUrl);
  }

  goForwardBrowser(): void {
    if (this.browserHistoryIndex() >= this.browserHistory().length - 1) return;
    const nextIndex = this.browserHistoryIndex() + 1;
    const nextUrl = this.browserHistory()[nextIndex];
    this.browserHistoryIndex.set(nextIndex);
    this.browserUrl.set(nextUrl);
    this.browserAddress.set(nextUrl);
  }

  reloadBrowser(): void {
    this.browserReloadToken.update(n => n + 1);
  }

  ngOnInit(): void {
    setInterval(() => { this.currentTime = new Date(); }, 60000);
  }

  createFolder() {
    const name = prompt('Digite o nome da nova pasta:', 'Nova Pasta');
    if (!name) return;

    const newFolder: VirtualFile = {
      id: 'fold-' + Date.now().toString(),
      name: name,
      type: 'folder',
      children: [],
      parentId: 'desktop'
    };

    this.files.update(all => [...all, newFolder]);
  }

  openFolder(folder: VirtualFile) {
    this.windows.update(wins => wins.map(w => {
      if (w.id === 'explorer') {
        this.topZIndex++;
        return { ...w, isOpen: true, isMinimized: false, zIndex: this.topZIndex, title: folder.name, folderId: folder.id };
      }
      return w;
    }));
  }

  getItemsInFolder(folderId: string | null | undefined) {
    if (!folderId) return [];
    return this.files().filter(f => f.parentId === folderId);
  }

  openInternetExplorer() {
    this.openWindow('internet-explorer');
    this.browserAddress.set(this.browserUrl());
  }

  deleteItem(id: string, event: Event) {
    event.stopPropagation();
    if (confirm('Tem certeza que deseja deletar este item?')) {
      this.files.update(all => all.filter(f => f.id !== id && f.parentId !== id));
    }
  }

  newFile() {
    this.activeFileId.set(null);
    this.notepadFileName.set('Sem título.txt');
    this.notepadTextArea.set('');
  }

  saveFile() {
    const currentId = this.activeFileId();
    const currentText = this.notepadTextArea();

    if (currentId) {
      this.files.update(all => all.map(f => f.id === currentId ? { ...f, content: currentText } : f));
      alert('Arquivo salvo!');
    } else {
      const name = prompt('Nome do arquivo:', this.notepadFileName());
      if (!name) return;

      const newId = 'txt-' + Date.now().toString();
      const formattedName = name.endsWith('.txt') ? name : `${name}.txt`;
      const explorerWin = this.windows().find(w => w.id === 'explorer');
      const targetParent = (explorerWin?.isOpen && this.activeWindowId() === 'explorer') ? explorerWin.folderId! : 'desktop';

      const newFile: VirtualFile = {
        id: newId,
        name: formattedName,
        type: 'file',
        content: currentText,
        parentId: targetParent
      };

      this.files.update(all => [...all, newFile]);
      this.activeFileId.set(newId);
      this.notepadFileName.set(formattedName);
    }
  }

  openFile(file: VirtualFile) {
    this.activeFileId.set(file.id);
    this.notepadFileName.set(file.name);
    this.notepadTextArea.set(file.content || '');
    this.openWindow('notepad');
  }

  deleteFile(fileId: string, event: Event) {
    event.stopPropagation();
    if (confirm('Tem certeza que deseja deletar este arquivo?')) {
      this.files.update(allFiles => allFiles.filter(f => f.id !== fileId));
      if (this.activeFileId() === fileId) {
        this.newFile();
      }
    }
  }

  toggleStartMenu() {
    this.isStartMenuOpen.update(v => !v);
  }

  openWindow(id: string) {
    this.isStartMenuOpen.set(false);
    this.windows.update(wins => wins.map(w => {
      if (w.id === id) {
        this.topZIndex++;
        return { ...w, isOpen: true, isMinimized: false, zIndex: this.topZIndex };
      }
      return w;
    }));
  }

  focusWindow(id: string) {
    this.windows.update(wins => wins.map(w => {
      if (w.id === id) {
        this.topZIndex++;
        return { ...w, isMinimized: false, zIndex: this.topZIndex };
      }
      return w;
    }));
  }

  minimizeWindow(id: string, event: Event) {
    event.stopPropagation();
    this.windows.update(wins => wins.map(w => w.id === id ? { ...w, isMinimized: true } : w));
  }

  maximizeWindow(id: string, event: Event) {
    event.stopPropagation();
    this.windows.update(wins => wins.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
  }

  closeWindow(id: string, event: Event) {
    event.stopPropagation();
    this.windows.update(wins => wins.map(w => w.id === id ? { ...w, isOpen: false } : w));
  }

  onRightClick(event: MouseEvent) {
    event.preventDefault();
    this.contextMenu.set({ isOpen: true, x: event.clientX, y: event.clientY });
  }

  closeContextMenu() {
    if (this.contextMenu().isOpen) {
      this.contextMenu.set({ isOpen: false, x: 0, y: 0 });
    }
  }

  display = signal<string>('');

  appendInput(value: string): void {
    const operators = ['+', '-', '*', '/'];
    const currentDisplay = this.display();
    const lastChar = currentDisplay.slice(-1);

    if (operators.includes(value) && operators.includes(lastChar)) {
      this.display.set(currentDisplay.slice(0, -1) + value);
      return;
    }

    this.display.update(current => current + value);
  }

  clear(): void {
    this.display.set('');
  }

  calculate(): void {
    try {
      const expression = this.display();
      if (!expression) return;

      const compute = new Function(`return ${expression}`);
      const result = compute();

      if (result === Infinity || isNaN(result)) {
        this.display.set('Erro');
      } else {
        this.display.set(Number(result.toFixed(8)).toString());
      }
    } catch (e) {
      this.display.set('Erro');
    }
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
      this.paintDrawPreview(context, width, height);
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

  private paintDrawPreview(context: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.paintPreview) {
      return;
    }

    context.save();
    context.strokeStyle = '#000000';
    context.fillStyle = '#000000';
    context.lineWidth = 1;
    const start = this.paintPreview.start;
    const end = this.paintPreview.end;
    const zoom = this.paintZoom();
    const startX = start.x * zoom;
    const startY = start.y * zoom;
    const endX = end.x * zoom;
    const endY = end.y * zoom;

    switch (this.paintPreview.tool) {
      case 'line':
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        break;
      case 'rectangle':
        context.strokeRect(startX, startY, endX - startX, endY - startY);
        break;
      case 'ellipse':
        context.beginPath();
        context.ellipse(startX, startY, Math.abs(endX - startX), Math.abs(endY - startY), 0, 0, Math.PI * 2);
        context.stroke();
        break;
      case 'rounded-rectangle':
        context.beginPath();
        const radius = 12;
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);
        context.moveTo(x + radius, y);
        context.lineTo(x + w - radius, y);
        context.quadraticCurveTo(x + w, y, x + w, y + radius);
        context.lineTo(x + w, y + h - radius);
        context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        context.lineTo(x + radius, y + h);
        context.quadraticCurveTo(x, y + h, x, y + h - radius);
        context.lineTo(x, y + radius);
        context.quadraticCurveTo(x, y, x + radius, y);
        context.closePath();
        context.stroke();
        break;
      default:
        break;
    }

    context.restore();
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
      const nextZoom = clamp(this.paintZoom() + 0.5, 0.5, 6);
      this.paintZoom.set(nextZoom);
      this.paintRender();
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

    if (tool === 'rect-select' || tool === 'free-select') {
      const currentSelection = this.paintSelection();
      if (currentSelection) {
        this.paintSelection.set(null);
      }
      const nextSelection: SelectionArea = { x: point.x, y: point.y, width: 1, height: 1 };
      this.paintSelection.set(nextSelection);
      this.paintPreview = { tool: tool === 'free-select' ? 'line' : 'rectangle', start: point, end: point };
      this.paintRender();
      return;
    }
  }

  private paintCompleteShapeOperation(): void {
    if (!this.paintPreview) {
      return;
    }

    const { start, end } = this.paintPreview;
    const context = this.paintBaseCanvas.getContext('2d');
    if (!context) {
      return;
    }

    const fillMode = this.fillStyle();
    const color = this.primaryColor();
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const right = Math.max(start.x, end.x);
    const bottom = Math.max(start.y, end.y);
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);

    if (this.paintPreview.tool === 'line') {
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.strokeStyle = color;
      context.lineWidth = this.strokeWidth();
      context.stroke();
    }

    if (this.paintPreview.tool === 'rectangle') {
      if (fillMode !== 'outline') {
        context.fillStyle = color;
        context.fillRect(left, top, width, height);
      }
      if (fillMode !== 'filled') {
        context.strokeStyle = color;
        context.strokeRect(left, top, width, height);
      }
    }

    if (this.paintPreview.tool === 'ellipse') {
      context.beginPath();
      context.ellipse(left + width / 2, top + height / 2, Math.max(1, width / 2), Math.max(1, height / 2), 0, 0, Math.PI * 2);
      if (fillMode !== 'outline') {
        context.fillStyle = color;
        context.fill();
      }
      if (fillMode !== 'filled') {
        context.strokeStyle = color;
        context.stroke();
      }
    }

    if (this.paintPreview.tool === 'rounded-rectangle') {
      const radius = Math.min(20, Math.max(5, Math.min(width, height) / 5));
      const drawRect = new Path2D();
      drawRect.moveTo(left + radius, top);
      drawRect.lineTo(right - radius, top);
      drawRect.quadraticCurveTo(right, top, right, top + radius);
      drawRect.lineTo(right, bottom - radius);
      drawRect.quadraticCurveTo(right, bottom, right - radius, bottom);
      drawRect.lineTo(left + radius, bottom);
      drawRect.quadraticCurveTo(left, bottom, left, bottom - radius);
      drawRect.lineTo(left, top + radius);
      drawRect.quadraticCurveTo(left, top, left + radius, top);
      drawRect.closePath();
      if (fillMode !== 'outline') {
        context.fillStyle = color;
        context.fill(drawRect);
      }
      if (fillMode !== 'filled') {
        context.strokeStyle = color;
        context.stroke(drawRect);
      }
    }

    if (this.paintPreview.tool === 'curve') {
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.quadraticCurveTo(start.x + (end.x - start.x) / 2, start.y - 40, end.x, end.y);
      context.strokeStyle = color;
      context.lineWidth = this.strokeWidth();
      context.stroke();
    }

    this.paintPreview = null;
    this.paintPushHistory('shape');
    this.paintStatusText.set('Shape committed to the canvas.');
    this.paintRender();
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
    const window = this.windows().find(item => item.id === 'paint');
    if (window) {
      this.windows.update(list => list.map(item => item.id === 'paint' ? { ...item, title: `${this.paintFileName()}${this.paintUnsaved() ? '*' : ''} - Paint` } : item));
    }
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
      magnifier: 'Click to zoom in and inspect pixels.',
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
    this.paintIsDrawing = true;
    canvas.setPointerCapture(event.pointerId);

    const point = toCanvasCoordinates(event.clientX, event.clientY, canvas, this.paintZoom());
    this.paintPointer.set(point);
    this.paintLastPoint = point;

    if (this.paintTool() === 'pencil') {
      this.paintPushHistory('pencil');
      this.paintDrawStroke(point, point, this.primaryColor());
      this.paintStatusText.set('Drawing on the canvas.');
      return;
    }

    if (this.paintTool() === 'brush') {
      this.paintPushHistory('brush');
      this.paintDrawBrush(point, point, this.primaryColor());
      return;
    }

    if (this.paintTool() === 'eraser') {
      this.paintPushHistory('eraser');
      this.paintDrawStroke(point, point, '#000000', true);
      return;
    }

    if (this.paintTool() === 'airbrush') {
      this.paintPushHistory('airbrush');
      this.paintDrawAirbrush(point, this.primaryColor());
      return;
    }

    if (this.paintTool() === 'line' || this.paintTool() === 'rectangle' || this.paintTool() === 'ellipse' || this.paintTool() === 'rounded-rectangle' || this.paintTool() === 'curve') {
      this.paintPreview = { tool: this.paintTool(), start: point, end: point };
      this.paintStatusText.set(this.paintToolHelp(this.paintTool()));
      return;
    }

    if (this.paintTool() === 'fill' || this.paintTool() === 'picker' || this.paintTool() === 'magnifier' || this.paintTool() === 'text') {
      this.paintToolActivated(point, event.button);
      return;
    }

    if (this.paintTool() === 'rect-select') {
      this.paintSelection.set({ x: point.x, y: point.y, width: 1, height: 1 });
      this.paintPreview = { tool: 'rectangle', start: point, end: point };
      return;
    }

    if (this.paintTool() === 'free-select') {
      this.paintSelection.set({ x: point.x, y: point.y, width: 1, height: 1 });
      this.paintPreview = { tool: 'line', start: point, end: point };
      return;
    }
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

    if (this.paintTool() === 'pencil') {
      const color = event.button === 2 ? this.secondaryColor() : this.primaryColor();
      if (this.paintLastPoint) {
        this.paintDrawStroke(this.paintLastPoint, point, color);
      }
      this.paintLastPoint = point;
      return;
    }

    if (this.paintTool() === 'brush') {
      const color = event.button === 2 ? this.secondaryColor() : this.primaryColor();
      if (this.paintLastPoint) {
        this.paintDrawBrush(this.paintLastPoint, point, color);
      }
      this.paintLastPoint = point;
      return;
    }

    if (this.paintTool() === 'eraser') {
      if (this.paintLastPoint) {
        this.paintDrawStroke(this.paintLastPoint, point, '#000000', true);
      }
      this.paintLastPoint = point;
      return;
    }

    if (this.paintTool() === 'airbrush') {
      this.paintDrawAirbrush(point, event.button === 2 ? this.secondaryColor() : this.primaryColor());
      return;
    }

    if (this.paintPreview) {
      this.paintPreview.end = point;
      this.paintRender();
    }
  }

  paintPointerUp(event: PointerEvent): void {
    const canvas = this.paintCanvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    if (this.paintIsDrawing && this.paintPreview && ['line', 'rectangle', 'ellipse', 'rounded-rectangle', 'curve'].includes(this.paintPreview.tool)) {
      this.paintCompleteShapeOperation();
    }

    this.paintIsDrawing = false;
    this.paintLastPoint = null;
    this.paintPreview = null;
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
