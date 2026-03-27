import { Component } from '@angular/core';
import { PlayerCombatCardComponent } from '@app/components/game-view-components/combat-view/player-combat-card/player-combat-card.component';
import { Posture } from '@app/constants/posture.enum';

@Component({
  selector: 'app-combat-view',
  imports: [PlayerCombatCardComponent],
  templateUrl: './combat-view.component.html',
  styleUrl: './combat-view.component.scss',
})
export class CombatViewComponent {

  Posture = Posture;

  isMyCombatTurn(): boolean{
    //todo
    return true;
  }

  setPosture(posture: Posture): void {
    //todo
  }
}