import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { VirtualFile, WindowItem } from './core/models';
import { DialogComponent } from './core/dialog/dialog.component';
import { DialogService } from './core/dialog/dialog.service';
import { FileSystemService } from './core/file-system.service';
import { WindowManagerService } from './core/window-manager.service';
import { BrowserComponent } from './apps/browser/browser.component';
import { CalculatorComponent } from './apps/calculator/calculator.component';
import { ExplorerComponent } from './apps/explorer/explorer.component';
import { NotepadComponent } from './apps/notepad/notepad.component';
import { MyComputerComponent } from './apps/my-computer/my-computer.component';
import { NotepadService } from './apps/notepad/notepad.service';
import { PaintComponent } from './apps/paint/paint.component';
import { TrashComponent } from './apps/trash/trash.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    BrowserComponent,
    CalculatorComponent,
    DialogComponent,
    ExplorerComponent,
    MyComputerComponent,
    NotepadComponent,
    PaintComponent,
    TrashComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  readonly windowManager = inject(WindowManagerService);
  readonly fileSystem = inject(FileSystemService);
  readonly notepad = inject(NotepadService);
  private dialog = inject(DialogService);

  private clockTimer?: ReturnType<typeof setInterval>;
  currentTime: Date = new Date();
  isStartMenuOpen = signal<boolean>(false);
  selectedIconId = signal<string | null>(null);
  // item preenchido quando o menu foi aberto sobre um arquivo ou pasta
  contextMenu = signal<{ isOpen: boolean; x: number; y: number; item?: VirtualFile }>({ isOpen: false, x: 0, y: 0 });

  ngOnInit(): void {
    this.clockTimer = setInterval(() => { this.currentTime = new Date(); }, 60000);
  }

  ngOnDestroy(): void {
    clearInterval(this.clockTimer);
  }

  createFolder() {
    const name = prompt('Digite o nome da nova pasta:', 'Nova Pasta');
    if (!name) return;
    this.fileSystem.createFolder(name);
  }

  openItem(item: VirtualFile) {
    if (item.type === 'folder') {
      this.windowManager.openWindow('explorer', { title: item.name, folderId: item.id });
    } else {
      this.notepad.openFile(item);
    }
  }

  selectIcon(id: string, event: Event) {
    event.stopPropagation();
    this.isStartMenuOpen.set(false);
    this.closeContextMenu();
    this.selectedIconId.set(id);
  }

  onItemRightClick(item: VirtualFile, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isStartMenuOpen.set(false);
    this.selectedIconId.set(item.id);
    this.contextMenu.set({ isOpen: true, x: event.clientX, y: event.clientY, item });
  }

  @HostListener('document:keydown.delete', ['$event'])
  @HostListener('document:keydown.shift.delete', ['$event'])
  onDeleteKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select') || this.dialog.current()) return;

    const item = this.fileSystem.files().find(f => f.id === this.selectedIconId());
    if (item) {
      // Shift+Delete exclui sem passar pela Lixeira, como no Windows
      this.confirmDelete(item, event.shiftKey);
    }
  }

  async confirmDelete(item: VirtualFile, permanent = false) {
    const isFolder = item.type === 'folder';
    const what = isFolder ? `a pasta '${item.name}' e todo o seu conteúdo` : `'${item.name}'`;
    const answer = await this.dialog.ask({
      title: isFolder ? 'Confirmar exclusão de pasta' : 'Confirmar exclusão de arquivo',
      icon: 'question',
      message: permanent
        ? `Tem certeza de que deseja excluir ${what} permanentemente?`
        : `Tem certeza de que deseja enviar ${what} para a Lixeira?`,
      buttons: ['Sim', 'Não'],
    });
    if (answer !== 'Sim') return;

    const deleted = permanent ? this.fileSystem.deleteItem(item.id) : this.fileSystem.moveToTrash(item.id);
    this.selectedIconId.set(null);

    const notepadFileId = this.notepad.activeFileId();
    if (notepadFileId && deleted.has(notepadFileId)) {
      this.notepad.newFile();
    }
    const explorer = this.windowManager.getWindow('explorer');
    if (explorer?.isOpen && explorer.folderId && deleted.has(explorer.folderId)) {
      this.windowManager.closeWindow('explorer');
    }
  }

  openWindow(id: string) {
    this.isStartMenuOpen.set(false);
    this.windowManager.openWindow(id);
  }

  openNotepad() {
    this.notepad.newFile();
    this.openWindow('notepad');
  }

  toggleStartMenu() {
    this.isStartMenuOpen.update(v => !v);
  }

  // a posição vem do cdkDragFreeDragPosition; aqui só tamanho e empilhamento
  getWindowStyle(win: WindowItem): Record<string, string | number> {
    if (win.isMaximized) {
      return {
        width: '100vw',
        height: 'calc(100vh - 28px)',
        zIndex: win.zIndex,
      };
    }

    return {
      width: `${win.width ?? 500}px`,
      height: 'auto',
      zIndex: win.zIndex,
    };
  }

  minimizeWindow(id: string, event: Event) {
    event.stopPropagation();
    this.windowManager.minimizeWindow(id);
  }

  maximizeWindow(id: string, event: Event) {
    event.stopPropagation();
    this.windowManager.toggleMaximize(id);
  }

  closeWindow(id: string, event: Event) {
    event.stopPropagation();
    this.windowManager.requestClose(id);
  }

  onRightClick(event: MouseEvent) {
    event.preventDefault();
    this.contextMenu.set({ isOpen: true, x: event.clientX, y: event.clientY });
  }

  closeContextMenu() {
    if (this.contextMenu().isOpen) {
      this.contextMenu.set({ isOpen: false, x: 0, y: 0 });
    }
  }
}
