import { Component, computed, effect, EventEmitter, inject, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { GameSession } from '@app/interfaces/game-session';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { getGameModeLabel, getGameSizeLabel } from '@app/utils/game-config.utils';

@Component({
  selector: 'app-game-session-list',
  imports: [],
  templateUrl: './game-session-list.component.html',
  styleUrl: './game-session-list.component.scss',
})
export class GameSessionListComponent implements OnInit, OnDestroy {
  gameSessionSocketService = inject(GameSessionSocketService);
  selectedGameSessionId = signal<string | null>(null);
  @Output() gameSessionSelected = new EventEmitter<string>();

  availableGameSessions = computed(() => this.gameSessionSocketService.gameSessions().filter(
    session => session.status === 'waiting' && session.players.length < session.maxPlayers));

  private clearUnavailableSelection = effect(() => {
    const selected = this.selectedGameSessionId();
    if (selected && !this.availableGameSessions().some(gameSession => gameSession.roomId === selected)) {
      this.selectedGameSessionId.set(null);
    }
  });

  ngOnInit(): void {
    this.gameSessionSocketService.connect();
  }

  ngOnDestroy(): void {
    this.clearUnavailableSelection.destroy();
  }

  selectGameSession(gameSessionId: string): void {
    this.selectedGameSessionId.set(gameSessionId);
    this.gameSessionSelected.emit(gameSessionId);
  }

  isSelected(gameSessionId: string): boolean {
    return this.selectedGameSessionId() === gameSessionId;
  }

  isSelectedAvailable(): boolean {
    const selected = this.selectedGameSessionId();
    return !!selected && this.availableGameSessions().some(gameSession => gameSession.roomId === selected);
  }

  getPreviewImage(gameSession: GameSession): string {
    return gameSession.mapCopy?.previewImage ?? '';
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