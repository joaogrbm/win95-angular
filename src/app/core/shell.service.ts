import { Injectable, inject } from '@angular/core';
import { NotepadService } from '../apps/notepad/notepad.service';
import { PaintFilesService } from '../apps/paint/paint-files.service';
import { VirtualFile } from './models';
import { WindowManagerService } from './window-manager.service';

// Decide com qual programa cada item abre e qual ícone ele mostra,
// como as associações de arquivo do Windows.
@Injectable({ providedIn: 'root' })
export class ShellService {
  private windowManager = inject(WindowManagerService);
  private notepad = inject(NotepadService);
  private paintFiles = inject(PaintFilesService);

  open(item: VirtualFile) {
    switch (item.type) {
      case 'folder':
        this.windowManager.openWindow('explorer', { title: item.name, folderId: item.id });
        break;
      case 'image':
        this.paintFiles.openRequest.set(item);
        this.windowManager.openWindow('paint');
        break;
      default:
        this.notepad.openFile(item);
    }
  }

  iconFor(item: VirtualFile): string {
    switch (item.type) {
      case 'folder':
        return 'folder.ico';
      case 'image':
        return 'pbrush_1.ico';
      default:
        return 'notepad_2.ico';
    }
  }
}
