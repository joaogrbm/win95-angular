import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop'; // 1. IMPORTAR AQUI
import { FormsModule } from '@angular/forms'; // ⚠️ IMPORTANTE: Adicione o FormsModule para usar o [(ngModel)] no textarea

export interface WindowItem {
  id: string;
  title: string;
  icon: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
}

export interface VirtualFile {
  id: string;
  name: string;
  content: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule,DragDropModule,FormsModule],
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
    { id: 'paint', title: 'Untitled - Paint', icon: 'paint.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 },
    { id: 'notepad', title: 'Bloco de Notas', icon: 'notepad.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 } // Adicionado Notepad
  ]);

  files = signal<VirtualFile[]>([
    { id: '1', name: 'LEIA-ME.txt', content: 'Bem-vindo ao Windows 95 construído em Angular 19!\n\nEste é o seu Bloco de Notas virtual.' }
  ]);
  
  activeFileId = signal<string | null>(null);
  notepadFileName = signal<string>('Sem título.txt');
  notepadTextArea = signal<string>('');

  openWindows = computed(() => this.windows().filter(w => w.isOpen));
  
  activeWindowId = computed(() => {
    const visibleWindows = this.windows().filter(w => w.isOpen && !w.isMinimized);
    if (visibleWindows.length === 0) return null;
    const active = visibleWindows.reduce((prev, current) => (prev.zIndex > current.zIndex) ? prev : current);
    return active.id;
  });

  ngOnInit(): void {
    setInterval(() => { this.currentTime = new Date(); }, 60000);
  }

  // --- FUNÇÕES DO BLOCO DE NOTAS ---
  
  // Criar um arquivo Novo (limpa a tela do Bloco de Notas)
  newFile() {
    this.activeFileId.set(null);
    this.notepadFileName.set('Sem título.txt');
    this.notepadTextArea.set('');
  }

  // Salvar o arquivo (Cria um novo na lista ou atualiza o existente)
  saveFile() {
    const currentId = this.activeFileId();
    const currentText = this.notepadTextArea();
    
    if (currentId) {
      // Atualiza arquivo existente
      this.files.update(allFiles => allFiles.map(f => 
        f.id === currentId ? { ...f, content: currentText } : f
      ));
      alert('Arquivo salvo com sucesso!');
    } else {
      // Cria um novo arquivo pedindo o nome
      const name = prompt('Digite o nome do arquivo:', this.notepadFileName());
      if (!name) return;

      const newId = Date.now().toString();
      const formattedName = name.endsWith('.txt') ? name : `${name}.txt`;

      const newFile: VirtualFile = {
        id: newId,
        name: formattedName,
        content: currentText
      };

      this.files.update(allFiles => [...allFiles, newFile]);
      this.activeFileId.set(newId);
      this.notepadFileName.set(formattedName);
    }
  }

  // Abrir um arquivo selecionado
  openFile(file: VirtualFile) {
    this.activeFileId.set(file.id);
    this.notepadFileName.set(file.name);
    this.notepadTextArea.set(file.content);
    this.openWindow('notepad'); // Garante que a janela do bloco de notas abra
  }

  // Deletar um arquivo
  deleteFile(fileId: string, event: Event) {
    event.stopPropagation(); // Evita dar duplo clique e abrir sem querer
    if (confirm('Tem certeza que deseja deletar este arquivo?')) {
      this.files.update(allFiles => allFiles.filter(f => f.id !== fileId));
      if (this.activeFileId() === fileId) {
        this.newFile();
      }
    }
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