import { Component, ElementRef, effect, inject, viewChildren } from '@angular/core';
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

  readonly icons = { warning: '⚠️', question: '❓', info: 'ℹ️' };

  constructor() {
    // foca o primeiro botão, assim Enter escolhe a opção padrão
    effect(() => this.buttons()[0]?.nativeElement.focus());
  }
}
