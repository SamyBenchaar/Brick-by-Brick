import { Component, Input, signal } from '@angular/core';

@Component({
  selector: 'app-base-sign',
  imports: [],
  templateUrl: './base-sign.component.html',
  styleUrl: './base-sign.component.scss',
})
export class BaseSignComponent {
  @Input() name: string = '';
  @Input() iconUrl: string = '';
  isExpanded = signal(true);

  toggleSign(): void{
    this.isExpanded.update(v => !v);
  }
}
