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

  deleteItem(id: string) {
    this.files.update(all => all.filter(f => f.id !== id && f.parentId !== id));
  }
}
