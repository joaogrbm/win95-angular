import { TestBed } from '@angular/core/testing';
import { FileSystemService } from './file-system.service';

describe('FileSystemService', () => {
  let service: FileSystemService;

  beforeEach(() => {
    service = TestBed.inject(FileSystemService);
  });

  it('lists the items inside a folder', () => {
    expect(service.getItemsInFolder('fold-1').map(f => f.name)).toEqual(['Segredo.txt']);
  });

  it('deletes a folder together with its children', () => {
    service.deleteItem('fold-1');
    expect(service.files().some(f => f.id === 'fold-1' || f.parentId === 'fold-1')).toBeFalse();
  });

  it('deletes nested subfolders too', () => {
    const sub = service.createFolder('Sub', 'fold-1');
    const nested = service.createTextFile('dentro.txt', '', sub.id);
    const deleted = service.deleteItem('fold-1');
    expect(deleted.has(nested.id)).toBeTrue();
    expect(service.files().some(f => f.id === sub.id || f.id === nested.id)).toBeFalse();
  });

  it('updates file content', () => {
    service.updateContent('txt-1', 'novo texto');
    expect(service.files().find(f => f.id === 'txt-1')?.content).toBe('novo texto');
  });
});
