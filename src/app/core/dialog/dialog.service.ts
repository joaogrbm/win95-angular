import { Injectable, signal } from '@angular/core';

export interface DialogOptions {
  title: string;
  message: string;
  icon?: 'warning' | 'question' | 'info';
  buttons: string[];
  // quando definido, mostra um campo de texto com este valor inicial
  input?: string;
}

interface OpenDialog extends DialogOptions {
  resolve: (answer: string | null) => void;
}

// Caixa de mensagem no estilo Windows 95. Resolve com o texto do botão clicado,
// ou null se a caixa for fechada pelo X ou pela tecla Esc.
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly current = signal<OpenDialog | null>(null);
  // texto digitado no campo do diálogo (quando ele tem um)
  readonly inputValue = signal('');

  ask(options: DialogOptions): Promise<string | null> {
    this.answer(null);
    this.inputValue.set(options.input ?? '');
    return new Promise(resolve => this.current.set({ ...options, resolve }));
  }

  // Pede um texto, como o prompt() do navegador. Resolve com o texto, ou null se cancelar.
  async prompt(title: string, message: string, initialValue = ''): Promise<string | null> {
    const answer = await this.ask({ title, message, buttons: ['OK', 'Cancelar'], input: initialValue });
    return answer === 'OK' ? this.inputValue() : null;
  }

  answer(answer: string | null) {
    const dialog = this.current();
    this.current.set(null);
    dialog?.resolve(answer);
  }
}
