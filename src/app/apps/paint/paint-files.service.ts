import { Injectable, signal } from '@angular/core';
import { VirtualFile } from '../../core/models';

// Liga o Paint aos arquivos do sistema: qual arquivo está aberto nele
// e pedidos para abrir uma imagem (vindos da área de trabalho ou do Explorador).
@Injectable({ providedIn: 'root' })
export class PaintFilesService {
  readonly currentFileId = signal<string | null>(null);
  readonly openRequest = signal<VirtualFile | null>(null);
}
