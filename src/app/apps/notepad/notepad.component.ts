import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotepadService } from './notepad.service';

@Component({
  selector: 'app-notepad',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './notepad.component.html',
  styleUrls: ['./notepad.component.scss'],
})
export class NotepadComponent {
  readonly notepad = inject(NotepadService);
}
