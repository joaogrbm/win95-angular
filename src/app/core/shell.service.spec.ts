import { TestBed } from '@angular/core/testing';
import { PaintFilesService } from '../apps/paint/paint-files.service';
import { NotepadService } from '../apps/notepad/notepad.service';
import { FILES_STORAGE_KEY, FileSystemService } from './file-system.service';
import { ShellService } from './shell.service';
import { WindowManagerService } from './window-manager.service';

describe('ShellService', () => {
  let shell: ShellService;
  let fileSystem: FileSystemService;
  let windows: WindowManagerService;

  beforeEach(() => {
    localStorage.removeItem(FILES_STORAGE_KEY);
    shell = TestBed.inject(ShellService);
    fileSystem = TestBed.inject(FileSystemService);
    windows = TestBed.inject(WindowManagerService);
  });

  afterEach(() => localStorage.removeItem(FILES_STORAGE_KEY));

  it('opens images in paint', () => {
    const image = fileSystem.createImageFile('casa.png', 'data:image/png;base64,');
    shell.open(image);
    expect(windows.getWindow('paint')?.isOpen).toBeTrue();
    expect(TestBed.inject(PaintFilesService).openRequest()).toBe(image);
    expect(shell.iconFor(image)).toBe('pbrush_1.ico');
  });

  it('opens text files in notepad and folders in the explorer', () => {
    const [text, folder] = ['txt-1', 'fold-1'].map(id => fileSystem.files().find(f => f.id === id)!);
    shell.open(text);
    expect(TestBed.inject(NotepadService).activeFileId()).toBe('txt-1');
    shell.open(folder);
    expect(windows.getWindow('explorer')?.folderId).toBe('fold-1');
  });
});
