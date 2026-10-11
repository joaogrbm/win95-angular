import { Injectable, inject, signal } from '@angular/core';
import { VirtualFile } from '../../core/models';
import { FileSystemService } from '../../core/file-system.service';
import { WindowManagerService } from '../../core/window-manager.service';

@Injectable({ providedIn: 'root' })
export class NotepadService {
  private fileSystem = inject(FileSystemService);
  private windowManager = inject(WindowManagerService);

  readonly activeFileId = signal<string | null>(null);
  readonly fileName = signal<string>('Sem título.txt');
  readonly text = signal<string>('');

  newFile() {
    this.activeFileId.set(null);
    this.fileName.set('Sem título.txt');
    this.text.set('');
  }

  openFile(file: VirtualFile) {
    this.activeFileId.set(file.id);
    this.fileName.set(file.name);
    this.text.set(file.content || '');
    this.windowManager.openWindow('notepad');
  }

  saveFile() {
    const currentId = this.activeFileId();
    const currentText = this.text();

    if (currentId) {
      this.fileSystem.updateContent(currentId, currentText);
      alert('Arquivo salvo!');
      return;
    }

    const name = prompt('Nome do arquivo:', this.fileName());
    if (!name) return;

    const formattedName = name.endsWith('.txt') ? name : `${name}.txt`;
    const explorerWin = this.windowManager.getWindow('explorer');
    const targetParent = (explorerWin?.isOpen && this.windowManager.activeWindowId() === 'explorer') ? explorerWin.folderId! : 'desktop';

    const newFile = this.fileSystem.createTextFile(formattedName, currentText, targetParent);
    this.activeFileId.set(newFile.id);
    this.fileName.set(formattedName);
  }
}
