import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { BaseSignComponent } from '@app/components/game-view-components/base-sign/base-sign.component';
import { AVATARS } from '@app/constants/character-constants';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { GameModeValue } from '@common/constants/game-config-constants';
import { Player } from '@common/player';

@Component({
  selector: 'app-player-board',
  imports: [BaseSignComponent, CommonModule],
  templateUrl: './player-board.component.html',
  styleUrl: './player-board.component.scss',
})
export class PlayerBoardComponent {
  @Input() players: Player[] = [];
  @Input() leftPlayers: Player[] = [];
  @Input() host: Player | undefined = undefined;
  @Input() gameMode: string = 'classic';
  @Input() currentPlayerTurn: string | null = null;
  name: string = 'Joueurs';

  private gameSessionService = inject(GameSessionSocketService);

  isCtfMode(): boolean {
    return this.gameMode === GameModeValue.Ctf;
  }

  isVirtualPlayer(player: Player): boolean {
    return !!player.virtualProfile;
  }

  isActivePlayer(player: Player): boolean {
    return player.character.id === this.currentPlayerTurn;
  }

  getSortedPlayers(): Player[] {
    const session = this.gameSessionService.currentSession();
    if (!session?.playerOrder || session.playerOrder.length === 0) {
      return [...this.players];
    }

    return [...this.players].sort((a, b) => {
      const indexA = session.playerOrder.indexOf(a.character.id);
      const indexB = session.playerOrder.indexOf(b.character.id);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      return 0;
    });
  }

  getAvatarImage(player: Player): string {
    return AVATARS.find(avatarOption => avatarOption.id === player.character.avatarId)?.image ?? './assets/images/lily.jpg';
  }
}
