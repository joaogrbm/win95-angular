import { Component, inject, input } from '@angular/core';
import { VirtualFile } from '../../core/models';
import { FileSystemService } from '../../core/file-system.service';
import { ShellService } from '../../core/shell.service';

@Component({
  selector: 'app-explorer',
  standalone: true,
  templateUrl: './explorer.component.html',
  styleUrls: ['./explorer.component.scss'],
})
export class ExplorerComponent {
  private fileSystem = inject(FileSystemService);
  readonly shell = inject(ShellService);

  folderId = input<string | null | undefined>(null);

  get items(): VirtualFile[] {
    return this.fileSystem.getItemsInFolder(this.folderId());
  }
}
