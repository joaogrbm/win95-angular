import { Component, ElementRef, effect, inject, viewChild, viewChildren } from '@angular/core';
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
  private buttons = viewChildren<ElementRef<HTMLButtonElement>>('dialogButton');
  private input = viewChild<ElementRef<HTMLInputElement>>('dialogInput');

  readonly icons = { warning: '⚠️', question: '❓', info: 'ℹ️' };

  constructor() {
    // foca o campo de texto (com o texto selecionado) ou o primeiro botão,
    // assim Enter escolhe a opção padrão
    effect(() => {
      const input = this.input()?.nativeElement;
      if (input) {
        input.focus();
        input.select();
      } else {
        this.buttons()[0]?.nativeElement.focus();
      }
    });
  }
}
