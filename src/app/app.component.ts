//import { Component, signal, computed } from '@angular/core';
import { Component, signal, computed, OnInit } from '@angular/core';
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
  folderId?: string | null; // Guarda qual ID de pasta esta janela está exibindo (se for do tipo Explorer)
}

export interface VirtualFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: string[];
  parentId: 'desktop' | string;
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
    { id: 'notepad', title: 'Bloco de Notas', icon: 'notepad.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1 }, // Adicionado Notepad
    { id: 'explorer', title: 'Explorador', icon: 'folder.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1, folderId: null },
    { id: 'calculator', title: 'Calculadora', icon: 'calculator.png', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 1}

  ]);
  
  // --- SISTEMA DE ARQUIVOS VIRTUAL COMPLETO ---
  files = signal<VirtualFile[]>([
    { id: 'txt-1', name: 'LEIA-ME.txt', type: 'file', content: 'Bem-vindo ao Windows 95!', parentId: 'desktop' },
    { id: 'fold-1', name: 'Meus Documentos', type: 'folder', children: ['txt-interno'], parentId: 'desktop' },
    { id: 'txt-interno', name: 'Segredo.txt', type: 'file', content: 'Você achou este arquivo dentro da pasta!', parentId: 'fold-1' }
  ]);

  desktopItems = computed(() => this.files().filter(f => f.parentId === 'desktop'));

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

  // Criar uma nova pasta no Desktop
  createFolder() {
    const name = prompt('Digite o nome da nova pasta:', 'Nova Pasta');
    if (!name) return;

    const newFolder: VirtualFile = {
      id: 'fold-' + Date.now().toString(),
      name: name,
      type: 'folder',
      children: [],
      parentId: 'desktop'
    };

    this.files.update(all => [...all, newFolder]);
  }

  // Abrir uma Pasta (Ativa a janela do Explorer apontando para ela)
  openFolder(folder: VirtualFile) {
    this.windows.update(wins => wins.map(w => {
      if (w.id === 'explorer') {
        this.topZIndex++;
        return { ...w, isOpen: true, isMinimized: false, zIndex: this.topZIndex, title: folder.name, folderId: folder.id };
      }
      return w;
    }));
  }

  // Retorna os arquivos que estão dentro de uma pasta específica
  getItemsInFolder(folderId: string | null | undefined) {
    if (!folderId) return [];
    return this.files().filter(f => f.parentId === folderId);
  }

  // Deletar arquivo ou pasta
  deleteItem(id: string, event: Event) {
    event.stopPropagation();
    if (confirm('Tem certeza que deseja deletar este item?')) {
      // Remove o item e todos os filhos dele (se for pasta)
      this.files.update(all => all.filter(f => f.id !== id && f.parentId !== id));
    }
  }

  // --- FUNÇÕES DO BLOCO DE NOTAS ---
  
  // Criar um arquivo Novo (limpa a tela do Bloco de Notas)
  newFile() {
    this.activeFileId.set(null);
    this.notepadFileName.set('Sem título.txt');
    this.notepadTextArea.set('');
  }
  saveFile() {
    const currentId = this.activeFileId();
    const currentText = this.notepadTextArea();
    
    if (currentId) {
      this.files.update(all => all.map(f => f.id === currentId ? { ...f, content: currentText } : f));
      alert('Arquivo salvo!');
    } else {
      const name = prompt('Nome do arquivo:', this.notepadFileName());
      if (!name) return;

      const newId = 'txt-' + Date.now().toString();
      const formattedName = name.endsWith('.txt') ? name : `${name}.txt`;
      
      // Se a janela do explorer estiver aberta e ativa, salva o arquivo dentro dela!
      const explorerWin = this.windows().find(w => w.id === 'explorer');
      const targetParent = (explorerWin?.isOpen && this.activeWindowId() === 'explorer') ? explorerWin.folderId! : 'desktop';

      const newFile: VirtualFile = {
        id: newId,
        name: formattedName,
        type: 'file',
        content: currentText,
        parentId: targetParent
      };

      this.files.update(all => [...all, newFile]);
      this.activeFileId.set(newId);
      this.notepadFileName.set(formattedName);
    }
  }

  openFile(file: VirtualFile) {
    this.activeFileId.set(file.id);
    this.notepadFileName.set(file.name);
    this.notepadTextArea.set(file.content || '');
    this.openWindow('notepad');
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

  // --- PAINT: estado e lógica ---
  paintColor: string = '#000000';
  brushSize: number = 4;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;
  private history: ImageData[] = [];
  private currentCanvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private ensureContext(canvas: HTMLCanvasElement) {
    if (this.currentCanvas !== canvas) {
      this.currentCanvas = canvas;
      this.ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Make CSS size match layout and set backing store for crisp lines
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      canvas.width = Math.max(300, Math.round((rect.width || 600) * dpr));
      canvas.height = Math.max(150, Math.round((rect.height || 320) * dpr));
      if (this.ctx) {
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
      }
    }
  }

  pointerDown(event: PointerEvent, canvas: HTMLCanvasElement) {
    event.preventDefault();
    this.ensureContext(canvas);
    if (!this.ctx) return;
    try { this.history.push(this.ctx.getImageData(0, 0, canvas.width, canvas.height)); } catch (e) {}
    this.drawing = true;
    const rect = canvas.getBoundingClientRect();
    this.lastX = event.clientX - rect.left;
    this.lastY = event.clientY - rect.top;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  pointerMove(event: PointerEvent, canvas: HTMLCanvasElement) {
    if (!this.drawing || !this.ctx || this.currentCanvas !== canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.ctx.strokeStyle = this.paintColor;
    this.ctx.lineWidth = this.brushSize;
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x;
    this.lastY = y;
  }

  pointerUp(event: PointerEvent) {
    if (!this.drawing) return;
    this.drawing = false;
    try { (event.target as Element).releasePointerCapture?.(event.pointerId); } catch (e) {}
    if (this.ctx) this.ctx.closePath();
  }

  clearCanvas() {
    const c = this.currentCanvas;
    if (!c || !this.ctx) return;
    try { this.history.push(this.ctx.getImageData(0, 0, c.width, c.height)); } catch (e) {}
    this.ctx.clearRect(0, 0, c.width, c.height);
  }

  undo() {
    const c = this.currentCanvas;
    if (!c || !this.ctx || this.history.length === 0) return;
    const last = this.history.pop();
    if (last) this.ctx.putImageData(last, 0, 0);
  }

    // Estado do menu de contexto (botão direito)
  contextMenu = signal<{ isOpen: boolean; x: number; y: number }>({
    isOpen: false,
    x: 0,
    y: 0
  });

  // Função que captura o clique direito e abre o menu na posição do mouse
  onRightClick(event: MouseEvent) {
    event.preventDefault(); // Impede o menu padrão do navegador de abrir
    
    this.contextMenu.set({
      isOpen: true,
      x: event.clientX,
      y: event.clientY
    });
  }

  // Função para fechar o menu de contexto
  closeContextMenu() {
    if (this.contextMenu().isOpen) {
      this.contextMenu.set({ isOpen: false, x: 0, y: 0 });
    }
  }
// --- LÓGICA DA CALCULADORA (SEGURA COM SIGNALS) ---
display = signal<string>('');

appendInput(value: string): void {
  // Evita que o usuário digite múltiplos operadores seguidos por engano (ex: "++" ou "/*")
  const operators = ['+', '-', '*', '/'];
  const currentDisplay = this.display();
  const lastChar = currentDisplay.slice(-1);

  if (operators.includes(value) && operators.includes(lastChar)) {
    // Substitui o operador anterior pelo novo
    this.display.set(currentDisplay.slice(0, -1) + value);
    return;
  }

  this.display.update(current => current + value);
}

clear(): void {
  this.display.set('');
}

calculate(): void {
  try {
    const expression = this.display();
    if (!expression) return;

    // Criamos uma função segura em escopo isolado que resolve apenas a expressão matemática
    // É uma alternativa elegante e muito mais segura que o eval() bruto
    const compute = new Function(`return ${expression}`);
    const result = compute();

    if (result === Infinity || isNaN(result)) {
      this.display.set('Erro');
    } else {
      // Formata o resultado para evitar problemas de ponto flutuante longos (ex: 0.1 + 0.2)
      this.display.set(Number(result.toFixed(8)).toString());
    }
  } catch (e) {
    this.display.set('Erro');
  }
}
}

