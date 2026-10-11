import { Injectable, computed, signal } from '@angular/core';
import { WindowItem } from './models';

@Injectable({ providedIn: 'root' })
export class WindowManagerService {
  private topZIndex = 10;

  readonly windows = signal<WindowItem[]>([
    { id: 'computer', title: 'Meu Computador', icon: 'my-computer.png', isOpen: true, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'trash', title: 'Lixeira', icon: 'recycle-bin.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'paint', title: 'untitled - Paint', icon: 'pbrush_1.ico', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'notepad', title: 'Bloco de Notas', icon: 'notepad_2.ico', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'explorer', title: 'Explorador', icon: 'folder.ico', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1, folderId: null },
    { id: 'internet-explorer', title: 'Internet Explorer', icon: 'internet.ico', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'calculator', title: 'Calculadora', icon: 'calc.ico', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 }
  ]);

  readonly openWindows = computed(() => this.windows().filter(w => w.isOpen));

  readonly activeWindowId = computed(() => {
    const visibleWindows = this.windows().filter(w => w.isOpen && !w.isMinimized);
    if (visibleWindows.length === 0) return null;
    const active = visibleWindows.reduce((prev, current) => (prev.zIndex > current.zIndex) ? prev : current);
    return active.id;
  });

  getWindow(id: string): WindowItem | undefined {
    return this.windows().find(w => w.id === id);
  }

  openWindow(id: string, changes: Partial<WindowItem> = {}) {
    this.updateWindow(id, w => ({ ...w, ...changes, isOpen: true, isMinimized: false, zIndex: ++this.topZIndex }));
  }

  focusWindow(id: string) {
    this.updateWindow(id, w => ({ ...w, isMinimized: false, zIndex: ++this.topZIndex }));
  }

  minimizeWindow(id: string) {
    this.updateWindow(id, w => ({ ...w, isMinimized: true }));
  }

  toggleMaximize(id: string) {
    this.updateWindow(id, w => ({ ...w, isMaximized: !w.isMaximized }));
  }

  closeWindow(id: string) {
    this.updateWindow(id, w => ({ ...w, isOpen: false }));
  }

  setTitle(id: string, title: string) {
    this.updateWindow(id, w => ({ ...w, title }));
  }

  private updateWindow(id: string, change: (w: WindowItem) => WindowItem) {
    this.windows.update(wins => wins.map(w => w.id === id ? change(w) : w));
  }
}
