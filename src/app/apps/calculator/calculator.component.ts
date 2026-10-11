import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-calculator',
  standalone: true,
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss'],
})
export class CalculatorComponent {
  display = signal<string>('');

  appendInput(value: string): void {
    const operators = ['+', '-', '*', '/'];
    const currentDisplay = this.display();
    const lastChar = currentDisplay.slice(-1);

    if (operators.includes(value) && operators.includes(lastChar)) {
      this.display.set(currentDisplay.slice(0, -1) + value);
      return;
    }

    this.display.update(current => current + value);
  }

  clear(): void {
    this.display.set('');
  }

  calculate(): void {
    try {
      const expression = this.display();
      if (!expression) return;

      const compute = new Function(`return ${expression}`);
      const result = compute();

      if (result === Infinity || isNaN(result)) {
        this.display.set('Erro');
      } else {
        this.display.set(Number(result.toFixed(8)).toString());
      }
    } catch (e) {
      this.display.set('Erro');
    }
  }
}
