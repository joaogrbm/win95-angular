import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { VirtualFile, WindowItem } from './core/models';
import { FileSystemService } from './core/file-system.service';
import { WindowManagerService } from './core/window-manager.service';
import { BrowserComponent } from './apps/browser/browser.component';
import { CalculatorComponent } from './apps/calculator/calculator.component';
import { ExplorerComponent } from './apps/explorer/explorer.component';
import { NotepadComponent } from './apps/notepad/notepad.component';
import { NotepadService } from './apps/notepad/notepad.service';
import { PaintComponent } from './apps/paint/paint.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    BrowserComponent,
    CalculatorComponent,
    ExplorerComponent,
    NotepadComponent,
    PaintComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  readonly windowManager = inject(WindowManagerService);
  readonly fileSystem = inject(FileSystemService);
  readonly notepad = inject(NotepadService);

  private clockTimer?: ReturnType<typeof setInterval>;
  currentTime: Date = new Date();
  isStartMenuOpen = signal<boolean>(false);
  contextMenu = signal<{ isOpen: boolean; x: number; y: number }>({ isOpen: false, x: 0, y: 0 });

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

  deleteItem(id: string, event: Event) {
    event.stopPropagation();
    if (confirm('Tem certeza que deseja deletar este item?')) {
      this.fileSystem.deleteItem(id);
      if (this.notepad.activeFileId() === id) {
        this.notepad.newFile();
      }
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

  getWindowStyle(win: WindowItem): Record<string, string | number> {
    if (win.isMaximized) {
      return {
        top: '0px',
        left: '0px',
        width: '100vw',
        height: 'calc(100vh - 28px)',
        zIndex: win.zIndex,
      };
    }

    return {
      top: '100px',
      left: '200px',
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
    this.windowManager.closeWindow(id);
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
