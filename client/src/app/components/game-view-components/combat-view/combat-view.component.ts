import { Component, Input } from '@angular/core';
import { PlayerCombatCardComponent } from '@app/components/game-view-components/combat-view/player-combat-card/player-combat-card.component';
import { Character } from '@common/character';
import { COMBAT_POSTURE } from '@common/combat';

@Component({
  selector: 'app-combat-view',
  imports: [PlayerCombatCardComponent],
  templateUrl: './combat-view.component.html',
  styleUrl: './combat-view.component.scss',
})
export class CombatViewComponent {
  combatPosture = COMBAT_POSTURE;
  @Input() self: Character;
  @Input() other: Character;
  
  isMyCombatTurn(): boolean{
    //todo
    return true;
  }

  setPosture(combatPosture: string): void {
    //todo
  }
}
