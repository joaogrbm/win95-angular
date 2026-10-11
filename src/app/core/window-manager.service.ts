import { Injectable, computed, signal } from '@angular/core';
import { WindowItem } from './models';

// janelas novas abrem em cascata a partir deste ponto
const CASCADE_START = { x: 200, y: 60 };
const CASCADE_STEP = 30;
const CASCADE_SLOTS = 10;

@Injectable({ providedIn: 'root' })
export class WindowManagerService {
  private topZIndex = 10;
  // um app pode impedir o próprio fechamento (ex.: o Paint perguntando se quer salvar)
  private closeGuards = new Map<string, () => boolean | Promise<boolean>>();

  readonly windows = signal<WindowItem[]>([
    { id: 'computer', title: 'Meu Computador', icon: 'my-computer.png', isOpen: true, isMinimized: false, isMaximized: false, zIndex: 1, width: 400, ...CASCADE_START },
    { id: 'trash', title: 'Lixeira', icon: 'recycle-bin.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'paint', title: 'untitled - Paint', icon: 'pbrush_1.ico', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'notepad', title: 'Bloco de Notas', icon: 'notepad_2.ico', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'explorer', title: 'Explorador', icon: 'folder.ico', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1, folderId: null },
    { id: 'internet-explorer', title: 'Internet Explorer', icon: 'internet.ico', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'calculator', title: 'Calculadora', icon: 'calc.ico', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1, width: 280 }
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
    // uma janela que já está aberta mantém a posição; uma nova vai para a próxima vaga da cascata
    const position = this.getWindow(id)?.isOpen ? {} : this.nextCascadePosition();
    this.updateWindow(id, w => ({ ...w, ...position, ...changes, isOpen: true, isMinimized: false, zIndex: ++this.topZIndex }));
  }

  moveWindow(id: string, position: { x: number; y: number }) {
    this.updateWindow(id, w => ({ ...w, x: position.x, y: position.y }));
  }

  private nextCascadePosition(): { x: number; y: number } {
    const taken = new Set(this.openWindows().map(w => `${w.x},${w.y}`));
    for (let slot = 0; slot < CASCADE_SLOTS; slot++) {
      const x = CASCADE_START.x + slot * CASCADE_STEP;
      const y = CASCADE_START.y + slot * CASCADE_STEP;
      if (!taken.has(`${x},${y}`)) {
        return { x, y };
      }
    }
    return { ...CASCADE_START };
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

  async requestClose(id: string) {
    const guard = this.closeGuards.get(id);
    if (guard && !(await guard())) {
      return;
    }
    this.closeWindow(id);
  }

  setCloseGuard(id: string, guard: (() => boolean | Promise<boolean>) | null) {
    if (guard) {
      this.closeGuards.set(id, guard);
    } else {
      this.closeGuards.delete(id);
    }
  }

  setTitle(id: string, title: string) {
    this.updateWindow(id, w => ({ ...w, title }));
  }

  private updateWindow(id: string, change: (w: WindowItem) => WindowItem) {
    this.windows.update(wins => wins.map(w => w.id === id ? change(w) : w));
  }
}
