import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DialogService } from './dialog/dialog.service';
import { VirtualFile } from './models';

export const DESKTOP_ID = 'desktop';
export const TRASH_ID = 'trash';
export const FILES_STORAGE_KEY = 'angular95.files';

const DEFAULT_FILES: VirtualFile[] = [
  { id: 'txt-1', name: 'LEIA-ME.txt', type: 'file', content: 'Bem-vindo ao Windows 95!', parentId: 'desktop' },
  { id: 'fold-1', name: 'Meus Documentos', type: 'folder', children: ['txt-interno'], parentId: 'desktop' },
  { id: 'txt-interno', name: 'Segredo.txt', type: 'file', content: 'Você achou este arquivo dentro da pasta!', parentId: 'fold-1' }
];

// Lê os arquivos salvos no navegador. Se não houver nada (ou os dados estiverem
// corrompidos, ou o localStorage estiver bloqueado), começa com os arquivos padrão.
function loadFiles(): VirtualFile[] {
  try {
    const saved = JSON.parse(localStorage.getItem(FILES_STORAGE_KEY) ?? 'null');
    if (!Array.isArray(saved)) return DEFAULT_FILES;
    // o JSON guarda datas como texto
    return saved.map((f: VirtualFile) => f.deletedAt ? { ...f, deletedAt: new Date(f.deletedAt) } : f);
  } catch {
    return DEFAULT_FILES;
  }
}

@Injectable({ providedIn: 'root' })
export class FileSystemService {
  private dialog = inject(DialogService);
  readonly files = signal<VirtualFile[]>(loadFiles());
  private warnedDiskFull = false;

  constructor() {
    // grava a cada mudança, para os arquivos sobreviverem ao recarregar a página
    effect(() => {
      const files = this.files();
      try {
        localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files));
        this.warnedDiskFull = false;
      } catch (error) {
        // sem espaço (o navegador dá uns 5 MB): avisa uma vez em vez de perder dados em silêncio.
        // Com o localStorage bloqueado, segue só em memória sem avisar.
        if (error instanceof DOMException && error.name === 'QuotaExceededError' && !this.warnedDiskFull) {
          this.warnedDiskFull = true;
          this.dialog.ask({
            title: 'Disco cheio',
            icon: 'warning',
            message: 'Não há espaço suficiente no disco.\n\nAs últimas alterações serão perdidas ao recarregar a página. Exclua alguns arquivos e esvazie a Lixeira.',
            buttons: ['OK'],
          });
        }
      }
    });
  }

  readonly desktopItems = computed(() => this.files().filter(f => f.parentId === DESKTOP_ID));
  readonly trashItems = computed(() => this.files().filter(f => f.parentId === TRASH_ID));

  getItemsInFolder(folderId: string | null | undefined): VirtualFile[] {
    if (!folderId) return [];
    return this.files().filter(f => f.parentId === folderId);
  }

  createFolder(name: string, parentId = 'desktop'): VirtualFile {
    const newFolder: VirtualFile = {
      id: 'fold-' + Date.now().toString(),
      name,
      type: 'folder',
      children: [],
      parentId
    };

    this.files.update(all => [...all, newFolder]);
    return newFolder;
  }

  createTextFile(name: string, content: string, parentId = 'desktop'): VirtualFile {
    const newFile: VirtualFile = {
      id: 'txt-' + Date.now().toString(),
      name,
      type: 'file',
      content,
      parentId
    };

    this.files.update(all => [...all, newFile]);
    return newFile;
  }

  createImageFile(name: string, dataUrl: string, parentId = DESKTOP_ID): VirtualFile {
    const newFile: VirtualFile = {
      id: 'img-' + Date.now().toString(),
      name,
      type: 'image',
      content: dataUrl,
      parentId
    };

    this.files.update(all => [...all, newFile]);
    return newFile;
  }

  updateContent(id: string, content: string) {
    this.files.update(all => all.map(f => f.id === id ? { ...f, content } : f));
  }

  // O item e, se for uma pasta, tudo dentro dela (inclusive subpastas).
  private withDescendants(id: string): Set<string> {
    const ids = new Set([id]);
    let found = true;
    while (found) {
      found = false;
      for (const file of this.files()) {
        if (!ids.has(file.id) && ids.has(file.parentId)) {
          ids.add(file.id);
          found = true;
        }
      }
    }
    return ids;
  }

  // true se o item está acessível a partir da área de trabalho (não está na Lixeira)
  isReachable(id: string): boolean {
    let current = this.files().find(f => f.id === id);
    while (current) {
      if (current.parentId === DESKTOP_ID) return true;
      if (current.parentId === TRASH_ID) return false;
      current = this.files().find(f => f.id === current!.parentId);
    }
    return id === DESKTOP_ID;
  }

  // Manda o item para a Lixeira. O conteúdo de uma pasta vai junto, dentro dela.
  // Retorna os ids que deixaram de estar acessíveis.
  moveToTrash(id: string): Set<string> {
    const affected = this.withDescendants(id);
    this.files.update(all => all.map(f => f.id === id
      ? { ...f, parentId: TRASH_ID, originalParentId: f.parentId, deletedAt: new Date() }
      : f));
    return affected;
  }

  // Devolve o item para onde estava. Se a pasta original não existe mais
  // (ou também está na Lixeira), ele volta para a área de trabalho.
  restore(id: string) {
    const item = this.files().find(f => f.id === id);
    if (!item || item.parentId !== TRASH_ID) return;

    const target = item.originalParentId && this.isReachable(item.originalParentId) ? item.originalParentId : DESKTOP_ID;
    this.files.update(all => all.map(f => f.id === id
      ? { ...f, parentId: target, originalParentId: undefined, deletedAt: undefined }
      : f));
  }

  // Exclui permanentemente o item e tudo dentro dele. Retorna os ids excluídos.
  deleteItem(id: string): Set<string> {
    const deleted = this.withDescendants(id);
    this.files.update(all => all.filter(f => !deleted.has(f.id)));
    return deleted;
  }

  emptyTrash() {
    for (const item of this.trashItems()) {
      this.deleteItem(item.id);
    }
  }

  getName(id: string | undefined): string {
    if (!id || id === DESKTOP_ID) return 'Área de Trabalho';
    return this.files().find(f => f.id === id)?.name ?? 'Área de Trabalho';
  }
}
