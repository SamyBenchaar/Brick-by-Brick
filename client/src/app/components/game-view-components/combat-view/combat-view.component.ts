import { Component, effect, inject, signal } from '@angular/core';
import { PlayerCombatCardComponent } from '@app/components/game-view-components/combat-view/player-combat-card/player-combat-card.component';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { COMBAT_POSTURE } from '@common/combat';

@Component({
  selector: 'app-combat-view',
  imports: [PlayerCombatCardComponent],
  templateUrl: './combat-view.component.html',
  styleUrl: './combat-view.component.scss',
})
export class CombatViewComponent {
  combatPosture = COMBAT_POSTURE;
  gamePlaySocketService = inject(GamePlaySocketService);
  combatSocketService = inject(CombatSocketService);

  self = this.combatSocketService.self;
  other = this.combatSocketService.other;

  hasChosen = signal<boolean>(false);

  constructor() {
    effect(() => {
      const combat = this.combatSocketService.activeCombat();
      if (combat) {
        this.hasChosen.set(false);
      }
    });
  }

  setPosture(combatPosture: string): void {
    this.gamePlaySocketService.chooseCombatPosture(combatPosture);
    this.hasChosen.set(true);
  }
}
