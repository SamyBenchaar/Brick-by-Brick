import { Component, inject, Input, signal } from '@angular/core';
import { PlayerCombatCardComponent } from '@app/components/game-view-components/combat-view/player-combat-card/player-combat-card.component';
import { Character } from '@common/character';
import { COMBAT_POSTURE } from '@common/combat';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';

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

  hasChosen = signal<boolean>(true);
  gamePlaySocketService = inject(GamePlaySocketService)

  setPosture(combatPosture: string): void {
    this.gamePlaySocketService.chooseCombatPosture(combatPosture);
    this.hasChosen.set(false);
  }
}
