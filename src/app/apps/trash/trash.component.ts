import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { DialogService } from '../../core/dialog/dialog.service';
import { FileSystemService } from '../../core/file-system.service';
import { VirtualFile } from '../../core/models';

@Component({
  selector: 'app-trash',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './trash.component.html',
  styleUrls: ['./trash.component.scss'],
  host: { tabindex: '0', '(keydown.delete)': 'deleteSelected()' },
})
export class TrashComponent {
  readonly fileSystem = inject(FileSystemService);
  private dialog = inject(DialogService);

  readonly items = this.fileSystem.trashItems;
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.items().find(f => f.id === this.selectedId()) ?? null);

  restore() {
    const item = this.selected();
    if (!item) return;
    this.fileSystem.restore(item.id);
    this.selectedId.set(null);
  }

  async deleteSelected() {
    const item = this.selected();
    if (!item) return;

    const answer = await this.dialog.ask({
      title: item.type === 'folder' ? 'Confirmar exclusão de pasta' : 'Confirmar exclusão de arquivo',
      icon: 'question',
      message: `Tem certeza de que deseja excluir '${item.name}' permanentemente?`,
      buttons: ['Sim', 'Não'],
    });
    if (answer !== 'Sim') return;

    this.fileSystem.deleteItem(item.id);
    this.selectedId.set(null);
  }

  async emptyTrash() {
    const count = this.items().length;
    if (count === 0) return;

    const answer = await this.dialog.ask({
      title: 'Confirmar exclusão de vários arquivos',
      icon: 'question',
      message: count === 1
        ? `Tem certeza de que deseja excluir '${this.items()[0].name}' permanentemente?`
        : `Tem certeza de que deseja excluir permanentemente estes ${count} itens?`,
      buttons: ['Sim', 'Não'],
    });
    if (answer !== 'Sim') return;

    this.fileSystem.emptyTrash();
    this.selectedId.set(null);
  }

  icon(item: VirtualFile): string {
    return item.type === 'folder' ? 'folder.ico' : 'notepad_2.ico';
  }
}
