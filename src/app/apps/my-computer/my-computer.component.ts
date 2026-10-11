import { Component, computed, inject, signal } from '@angular/core';
import { DialogService } from '../../core/dialog/dialog.service';
import { DESKTOP_ID } from '../../core/file-system.service';
import { WindowManagerService } from '../../core/window-manager.service';

interface Drive {
  letter: string;
  label: string;
  kind: 'floppy' | 'disk' | 'cdrom';
  info: string;
}

@Component({
  selector: 'app-my-computer',
  standalone: true,
  templateUrl: './my-computer.component.html',
  styleUrls: ['./my-computer.component.scss'],
})
export class MyComputerComponent {
  private windowManager = inject(WindowManagerService);
  private dialog = inject(DialogService);

  readonly drives: Drive[] = [
    { letter: 'A', label: 'Disquete de 3½ (A:)', kind: 'floppy', info: 'Disquete de 3½ — Capacidade: 1,44 MB' },
    { letter: 'C', label: 'Disco Local (C:)', kind: 'disk', info: 'Espaço livre: 312 MB — Capacidade: 540 MB' },
    { letter: 'D', label: 'CD-ROM (D:)', kind: 'cdrom', info: 'Unidade de CD-ROM' },
  ];

  readonly selectedLetter = signal<string | null>(null);
  readonly statusText = computed(() =>
    this.drives.find(d => d.letter === this.selectedLetter())?.info ?? `${this.drives.length} objeto(s)`);

  async open(drive: Drive) {
    if (drive.kind === 'disk') {
      // o disco C: mostra os arquivos e pastas da área de trabalho
      this.windowManager.openWindow('explorer', { title: drive.label, folderId: DESKTOP_ID });
      return;
    }

    // sem disquete nem CD na unidade, como no Windows 95
    const answer = await this.dialog.ask({
      title: `${drive.letter}:\\`,
      icon: 'warning',
      message: `${drive.letter}:\\ não está acessível.\n\nO dispositivo não está pronto.`,
      buttons: ['Repetir', 'Cancelar'],
    });
    if (answer === 'Repetir') {
      this.open(drive);
    }
  }
}
