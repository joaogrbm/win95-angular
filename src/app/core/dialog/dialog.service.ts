import { Injectable, signal } from '@angular/core';

export interface DialogOptions {
  title: string;
  message: string;
  icon?: 'warning' | 'question' | 'info';
  buttons: string[];
}

interface OpenDialog extends DialogOptions {
  resolve: (answer: string | null) => void;
}

// Caixa de mensagem no estilo Windows 95. Resolve com o texto do botão clicado,
// ou null se a caixa for fechada pelo X ou pela tecla Esc.
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly current = signal<OpenDialog | null>(null);

  ask(options: DialogOptions): Promise<string | null> {
    this.answer(null);
    return new Promise(resolve => this.current.set({ ...options, resolve }));
  }

  answer(answer: string | null) {
    const dialog = this.current();
    this.current.set(null);
    dialog?.resolve(answer);
  }
}
