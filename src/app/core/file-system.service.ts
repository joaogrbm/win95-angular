import { Injectable, computed, signal } from '@angular/core';
import { VirtualFile } from './models';

@Injectable({ providedIn: 'root' })
export class FileSystemService {
  readonly files = signal<VirtualFile[]>([
    { id: 'txt-1', name: 'LEIA-ME.txt', type: 'file', content: 'Bem-vindo ao Windows 95!', parentId: 'desktop' },
    { id: 'fold-1', name: 'Meus Documentos', type: 'folder', children: ['txt-interno'], parentId: 'desktop' },
    { id: 'txt-interno', name: 'Segredo.txt', type: 'file', content: 'Você achou este arquivo dentro da pasta!', parentId: 'fold-1' }
  ]);

  readonly desktopItems = computed(() => this.files().filter(f => f.parentId === 'desktop'));

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

  updateContent(id: string, content: string) {
    this.files.update(all => all.map(f => f.id === id ? { ...f, content } : f));
  }

  // Exclui o item e, se for uma pasta, tudo dentro dela (inclusive subpastas).
  // Retorna os ids excluídos.
  deleteItem(id: string): Set<string> {
    const deleted = new Set([id]);
    let found = true;
    while (found) {
      found = false;
      for (const file of this.files()) {
        if (!deleted.has(file.id) && deleted.has(file.parentId)) {
          deleted.add(file.id);
          found = true;
        }
      }
    }

    this.files.update(all => all.filter(f => !deleted.has(f.id)));
    return deleted;
  }
}
