export interface WindowItem {
  id: string;
  title: string;
  icon: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  width?: number;
  folderId?: string | null;
}

export interface VirtualFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: string[];
  parentId: 'desktop' | string;
}
