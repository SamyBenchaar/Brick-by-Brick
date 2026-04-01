import { Component, computed, inject } from '@angular/core';
import { PlayerCombatCardComponent } from '@app/components/game-view-components/combat-view/player-combat-card/player-combat-card.component';
import { AVATARS } from '@app/constants/character-constants';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { CombatPosture } from '@common/combat';

@Component({
  selector: 'app-combat-view',
  imports: [PlayerCombatCardComponent],
  templateUrl: './combat-view.component.html',
  styleUrl: './combat-view.component.scss',
})
export class CombatViewComponent {
  private gamePlaySocketService = inject(GamePlaySocketService);

  Posture = CombatPosture;
  combat = computed(() => this.gamePlaySocketService.combatState());

  isMyCombatTurn(): boolean {
    return this.gamePlaySocketService.isMyCombatTurn();
  }

  setPosture(posture: CombatPosture): void {
    this.gamePlaySocketService.chooseCombatPosture(posture);
  }

  getAvatar(avatarId: number): string {
    return AVATARS.find((avatar) => avatar.id === avatarId)?.image ?? 'assets/images/lily.jpg';
  }
}