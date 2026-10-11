import { Injectable, inject, signal } from '@angular/core';
import { DialogService } from '../../core/dialog/dialog.service';
import { VirtualFile } from '../../core/models';
import { FileSystemService } from '../../core/file-system.service';
import { WindowManagerService } from '../../core/window-manager.service';

@Injectable({ providedIn: 'root' })
export class NotepadService {
  private fileSystem = inject(FileSystemService);
  private windowManager = inject(WindowManagerService);
  private dialog = inject(DialogService);

  readonly activeFileId = signal<string | null>(null);
  readonly fileName = signal<string>('Sem título.txt');
  readonly text = signal<string>('');

  constructor() {
    this.updateTitle();
  }

  // como no Bloco de Notas real: "arquivo.txt - Bloco de Notas"
  private updateTitle() {
    this.windowManager.setTitle('notepad', `${this.fileName()} - Bloco de Notas`);
  }

  newFile() {
    this.activeFileId.set(null);
    this.fileName.set('Sem título.txt');
    this.text.set('');
    this.updateTitle();
  }

  openFile(file: VirtualFile) {
    this.activeFileId.set(file.id);
    this.fileName.set(file.name);
    this.text.set(file.content || '');
    this.updateTitle();
    this.windowManager.openWindow('notepad');
  }

  async saveFile() {
    const currentId = this.activeFileId();
    const currentText = this.text();

    // o Bloco de Notas real salva em silêncio, sem mensagem de confirmação
    if (currentId) {
      this.fileSystem.updateContent(currentId, currentText);
      return;
    }

    const name = (await this.dialog.prompt('Salvar como', 'Nome do arquivo:', this.fileName()))?.trim();
    if (!name) return;

    const formattedName = name.endsWith('.txt') ? name : `${name}.txt`;
    const explorerWin = this.windowManager.getWindow('explorer');
    const targetParent = (explorerWin?.isOpen && this.windowManager.activeWindowId() === 'explorer') ? explorerWin.folderId! : 'desktop';

    const newFile = this.fileSystem.createTextFile(formattedName, currentText, targetParent);
    this.activeFileId.set(newFile.id);
    this.fileName.set(formattedName);
    this.updateTitle();
  }
}
