import { Component, inject, input } from '@angular/core';
import { VirtualFile } from '../../core/models';
import { FileSystemService } from '../../core/file-system.service';
import { WindowManagerService } from '../../core/window-manager.service';
import { NotepadService } from '../notepad/notepad.service';

@Component({
  selector: 'app-explorer',
  standalone: true,
  templateUrl: './explorer.component.html',
  styleUrls: ['./explorer.component.scss'],
})
export class ExplorerComponent {
  private fileSystem = inject(FileSystemService);
  private windowManager = inject(WindowManagerService);
  private notepad = inject(NotepadService);

  folderId = input<string | null | undefined>(null);

  get items(): VirtualFile[] {
    return this.fileSystem.getItemsInFolder(this.folderId());
  }

  open(item: VirtualFile) {
    if (item.type === 'folder') {
      this.windowManager.openWindow('explorer', { title: item.name, folderId: item.id });
    } else {
      this.notepad.openFile(item);
    }
  }
}
