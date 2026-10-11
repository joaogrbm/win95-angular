import { Component, ElementRef, Injector, afterNextRender, effect, inject, viewChild, viewChildren } from '@angular/core';
import { DialogService } from './dialog.service';

@Component({
  selector: 'app-dialog',
  standalone: true,
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss'],
  host: { '(document:keydown.escape)': 'dialog.current() && dialog.answer(null)' },
})
export class DialogComponent {
  readonly dialog = inject(DialogService);
  private injector = inject(Injector);
  // o Enter só confirma se foi apertado no próprio campo (ignora o Enter que fechou o diálogo anterior)
  private enterPressedInInput = false;
  private buttons = viewChildren<ElementRef<HTMLButtonElement>>('dialogButton');
  private input = viewChild<ElementRef<HTMLInputElement>>('dialogInput');

  readonly icons = { warning: '⚠️', question: '❓', info: 'ℹ️' };

  constructor() {
    // foca o campo de texto (com o texto selecionado) ou o primeiro botão,
    // assim Enter escolhe a opção padrão
    effect(() => {
      // roda a cada nova pergunta, depois que a tela foi atualizada com ela
      if (!this.dialog.current()) return;
      this.enterPressedInInput = false;
      afterNextRender(() => {
        const input = this.input()?.nativeElement;
        if (input) {
          input.focus();
          input.select();
        } else {
          this.buttons()[0]?.nativeElement.focus();
        }
      }, { injector: this.injector });
    });
  }

  onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.enterPressedInInput = true;
    }
  }

  // confirma ao soltar o Enter: assim a tecla já terminou quando o próximo diálogo abre
  onInputKeyup(event: KeyboardEvent, button: string) {
    if (event.key === 'Enter' && this.enterPressedInInput) {
      this.enterPressedInInput = false;
      this.dialog.answer(button);
    }
  }
}
