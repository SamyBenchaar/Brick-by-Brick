import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-hp-bar',
  templateUrl: './hp-bar.component.html',
  styleUrls: ['./hp-bar.component.scss'],
})
export class HpBarComponent {
  private static readonly percentageMultiplier = 100;

  @Input() current = 0;
  @Input() max = 100;

  get percentage(): number {
    return (this.current / this.max) * HpBarComponent.percentageMultiplier;
  }
}