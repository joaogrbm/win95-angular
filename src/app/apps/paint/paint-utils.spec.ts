import { flipImageData, floodFill, redoHistoryState, rotateImageData, undoHistoryState, createHistoryState } from './paint-utils';

function pixel(image: ImageData, x: number, y: number): number[] {
  const i = (y * image.width + x) * 4;
  return Array.from(image.data.slice(i, i + 4));
}

describe('paint-utils', () => {
  it('floodFill fills only the connected region', () => {
    const image = new ImageData(3, 1);
    image.data.set([0, 0, 0, 255], 4); // pixel do meio preto, separa as bordas
    const result = floodFill(image, 0, 0, '#ff0000');
    expect(pixel(result, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(result, 1, 0)).toEqual([0, 0, 0, 255]);
    expect(pixel(result, 2, 0)).toEqual([0, 0, 0, 0]);
  });

  it('rotateImageData by 90 degrees swaps width and height', () => {
    const image = new ImageData(2, 1);
    image.data.set([255, 0, 0, 255], 0);
    const rotated = rotateImageData(image, 90);
    expect(rotated.width).toBe(1);
    expect(rotated.height).toBe(2);
    expect(pixel(rotated, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it('flipImageData mirrors horizontally', () => {
    const image = new ImageData(2, 1);
    image.data.set([255, 0, 0, 255], 0);
    const flipped = flipImageData(image, true);
    expect(pixel(flipped, 1, 0)).toEqual([255, 0, 0, 255]);
  });

  it('undo and redo move states between history and future', () => {
    const a = createHistoryState(new ImageData(1, 1), 'a');
    const b = createHistoryState(new ImageData(1, 1), 'b');
    const undone = undoHistoryState([a, b], []);
    expect(undone.history).toEqual([a]);
    expect(undone.future).toEqual([b]);
    const redone = redoHistoryState(undone.history, undone.future);
    expect(redone.history).toEqual([a, b]);
  });
});
