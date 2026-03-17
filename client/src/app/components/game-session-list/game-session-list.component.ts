import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { getGameModeLabel, getGameSizeLabel } from '@common/constants/game-config-constants';
import { GameSession } from '@app/interfaces/game-session';

@Component({
  selector: 'app-game-session-list',
  imports: [],
  templateUrl: './game-session-list.component.html',
  styleUrl: './game-session-list.component.scss',
})
export class GameSessionListComponent implements OnInit, OnDestroy {
  gameSessionSocketService = inject(GameSessionSocketService);
  selectedGameSessionId = signal<string | null>(null);

  availableGameSessions = computed(() => this.gameSessionSocketService.gameSessions().filter(
    session => session.status === 'waiting' && session.players.length < session.maxPlayers));

  ngOnInit(): void {
    this.gameSessionSocketService.connect();
  }

  ngOnDestroy(): void {
    // this.gameSessionSocketService.disconnect();
  }

  selectGameSession(gameSessionId: string): void {
    this.selectedGameSessionId.set(gameSessionId);
  }

  isSelected(gameSessionId: string): boolean {
    return this.selectedGameSessionId() === gameSessionId;
  }

  getPreviewImage(gameSession: GameSession): string {
    const previewImage =  gameSession.mapCopy?.previewImage;
    if(previewImage) {
      return previewImage;
    }
    return '';
  }

  getGameSizeLabel(gameSession: GameSession): string {
    const size = gameSession.mapCopy?.mapConfig?.size;
    return size ? getGameSizeLabel(size) : '';
  }

  getGameModeLabel(gameSession: GameSession): string {
    const mode = gameSession.mapCopy?.gameMode;
    return mode ? getGameModeLabel(mode) : '';
  }
}