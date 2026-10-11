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
  // só para o polígono: os vértices, e se ainda está aberto (em construção)
  points?: Point[];
  open?: boolean;
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

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function hexToRgba(hex: string): [number, number, number, number] {
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
