export interface WindowItem {
  id: string;
  title: string;
  icon: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  width?: number;
  // posição na área de trabalho, definida ao abrir (em cascata) e ao arrastar
  x?: number;
  y?: number;
  folderId?: string | null;
}

export interface VirtualFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: string[];
  parentId: 'desktop' | 'trash' | string;
  // preenchidos quando o item está na Lixeira
  originalParentId?: string;
  deletedAt?: Date;
}
