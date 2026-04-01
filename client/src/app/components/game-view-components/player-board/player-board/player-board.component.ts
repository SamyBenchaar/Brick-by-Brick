import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { BaseSignComponent } from '@app/components/game-view-components/base-sign/base-sign.component';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
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
  name: string = 'Joueurs';

  private gameSessionService = inject(GameSessionSocketService);

  getTeamLabel(player: Player): string {
    if (!player.character.team) return '';
    return player.character.team === 'team1' ? 'Équipe 1' : 'Équipe 2';
  }

  isCtfMode(): boolean {
    return this.gameMode === 'ctf';
  }

  getCurrentPlayerCharacter() {
    const session = this.gameSessionService.currentSession();
    const socketId = this.gameSessionService.getSocketId();
    return session?.players.find(p => p.socketId === socketId)?.character;
  }

  canTransferFlagTo(targetPlayer: Player): boolean {
    if (!this.isCtfMode()) return false;

    const currentPlayer = this.getCurrentPlayerCharacter();
    if (!currentPlayer?.hasFlag) return false;
    if ((currentPlayer.remainingActions ?? 0) <= 0) return false;

    if (currentPlayer.id === targetPlayer.character.id) return false;
    if (currentPlayer.team !== targetPlayer.character.team) return false;

    return true;
  }

  canRequestFlagFrom(targetPlayer: Player): boolean {
    if (!this.isCtfMode()) return false;

    const currentPlayer = this.getCurrentPlayerCharacter();
    if (!currentPlayer) return false;
    if ((currentPlayer.remainingActions ?? 0) <= 0) return false;

    if (!currentPlayer.hasFlag && targetPlayer.character.hasFlag) {
      if (currentPlayer.id !== targetPlayer.character.id && currentPlayer.team === targetPlayer.character.team) {
        return true;
      }
    }

    return false;
  }

  requestFlagTransfer(targetPlayer: Player): void {
    this.gameSessionService.requestFlagTransfer(targetPlayer.character.id);
  }
}
