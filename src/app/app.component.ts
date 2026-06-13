import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop'; // 1. IMPORTAR AQUI

export interface WindowItem {
  id: string;
  title: string;
  icon: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule,DragDropModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  currentTime: Date = new Date();
  // Estado do Menu Iniciar
  isStartMenuOpen = signal<boolean>(false);
  
  // Contador para controlar qual janela fica por cima
  private topZIndex = 10;

  // Signal com a lista de janelas disponíveis no sistema
  windows = signal<WindowItem[]>([
    { id: 'computer', title: 'Meu Computador', icon: 'my-computer.png', isOpen: true, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'trash', title: 'Lixeira', icon: 'recycle-bin.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'paint', title: 'Untitled - Paint', icon: 'paint.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 }
  ]);

  // Computed Signal para listar apenas as janelas que aparecem na barra de tarefas (abertas)
  openWindows = computed(() => this.windows().filter(w => w.isOpen));

  // 2. NOVA FUNCIONALIDADE: Descobre o ID da janela ativa (maior zIndex visível)
  activeWindowId = computed(() => {
    // Filtra apenas as janelas que estão visíveis na tela no momento
    const visibleWindows = this.windows().filter(w => w.isOpen && !w.isMinimized);
    
    if (visibleWindows.length === 0) return null;

    // Reduz a lista para encontrar a janela com o maior zIndex
    const active = visibleWindows.reduce((prev, current) => 
      (prev.zIndex > current.zIndex) ? prev : current
    );

    return active.id;
  });

  // Inicializa o relógio da barra de tarefas
  ngOnInit(): void {
    setInterval(() => {
      this.currentTime = new Date();
    }, 60000);
  }

  // Alternar Menu Iniciar
  toggleStartMenu() {
    this.isStartMenuOpen.update(v => !v);
  }

  // Abrir uma janela (via duplo clique no desktop ou Menu Iniciar)
  openWindow(id: string) {
    this.isStartMenuOpen.set(false); // Fecha o menu iniciar se estiver aberto
    this.windows.update(wins => wins.map(w => {
      if (w.id === id) {
        this.topZIndex++;
        return { ...w, isOpen: true, isMinimized: false, zIndex: this.topZIndex };
      }
      return w;
    }));
  }

  // Focar na janela ao clicar nela
  focusWindow(id: string) {
    this.windows.update(wins => wins.map(w => {
      if (w.id === id) {
        this.topZIndex++;
        return { ...w, isMinimized: false, zIndex: this.topZIndex };
      }
      return w;
    }));
  }

  // Minimizar Janela
  minimizeWindow(id: string, event: Event) {
    event.stopPropagation();
    this.windows.update(wins => wins.map(w => 
      w.id === id ? { ...w, isMinimized: true } : w
    ));
  }

  // Maximizar / Restaurar Janela
  maximizeWindow(id: string, event: Event) {
    event.stopPropagation();
    this.windows.update(wins => wins.map(w => 
      w.id === id ? { ...w, isMaximized: !w.isMaximized } : w
    ));
  }

  // Fechar Janela
  closeWindow(id: string, event: Event) {
    event.stopPropagation();
    this.windows.update(wins => wins.map(w => 
      w.id === id ? { ...w, isOpen: false } : w
    ));
  }
}