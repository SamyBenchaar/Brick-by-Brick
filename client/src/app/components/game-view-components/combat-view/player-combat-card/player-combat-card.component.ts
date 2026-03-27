import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-player-combat-card',
  imports: [],
  templateUrl: './player-combat-card.component.html',
  styleUrl: './player-combat-card.component.scss',
})
export class PlayerCombatCardComponent {
    @Input() name: string = 'nom';
    @Input() avatar: string = 'assets/images/lily.jpg';
    @Input() life: number = 0;
    @Input() maxLife: number = 0;
}
