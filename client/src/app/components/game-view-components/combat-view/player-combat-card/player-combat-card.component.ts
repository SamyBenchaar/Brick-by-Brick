import { Component, Input } from '@angular/core';
import { CombatPlayerState, CombatPosture, CombatScoreDetail } from '@common/combat';

@Component({
  selector: 'app-player-combat-card',
  imports: [],
  templateUrl: './player-combat-card.component.html',
  styleUrl: './player-combat-card.component.scss',
})
export class PlayerCombatCardComponent {
  @Input() player: CombatPlayerState = {
    id: '',
    name: 'nom',
    avatarId: 0,
    life: 0,
    maxLife: 0,
    attack: 0,
    defense: 0,
    attackDice: 'D4' as any,
    defenseDice: 'D6' as any,
    victories: 0,
    posture: CombatPosture.None,
    hasChosen: false,
  };

  @Input() avatar = 'assets/images/lily.jpg';
  @Input() attack: CombatScoreDetail | null = null;
  @Input() defense: CombatScoreDetail | null = null;
  @Input() damage = 0;
}
