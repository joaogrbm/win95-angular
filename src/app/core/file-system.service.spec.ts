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

  it('moves a folder to the trash with its content and restores it', () => {
    service.moveToTrash('fold-1');
    expect(service.desktopItems().some(f => f.id === 'fold-1')).toBeFalse();
    expect(service.trashItems().map(f => f.id)).toEqual(['fold-1']);
    expect(service.getItemsInFolder('fold-1').length).toBe(1);

    service.restore('fold-1');
    expect(service.trashItems().length).toBe(0);
    expect(service.desktopItems().some(f => f.id === 'fold-1')).toBeTrue();
  });

  it('restores to the desktop when the original folder is gone', () => {
    service.moveToTrash('txt-interno');
    service.deleteItem('fold-1');
    service.restore('txt-interno');
    expect(service.files().find(f => f.id === 'txt-interno')?.parentId).toBe('desktop');
  });

  it('empties the trash permanently', () => {
    service.moveToTrash('fold-1');
    service.moveToTrash('txt-1');
    service.emptyTrash();
    expect(service.files().length).toBe(0);
  });

  it('updates file content', () => {
    service.updateContent('txt-1', 'novo texto');
    expect(service.files().find(f => f.id === 'txt-1')?.content).toBe('novo texto');
  });
});
