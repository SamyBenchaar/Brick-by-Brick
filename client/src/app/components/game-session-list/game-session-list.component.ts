import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { signal } from '@angular/core';
import { computed } from '@angular/core';

@Component({
  selector: 'app-game-session-list',
  imports: [],
  templateUrl: './game-session-list.component.html',
  styleUrl: './game-session-list.component.scss',
})
export class GameSessionListComponent {
    private gameSessionSocketService = inject(GameSessionSocketService);
    selectedGameSessionId = signal<string | null>(null);

    availableGameSessions = computed (() => this.gameSessionSocketService.gameSessions().filter(
      session => session.status === 'waiting' && session.players.length < session.maxPlayers
    ));

    ngOnInit(): void {
      this.gameSessionSocketService.connect();
    }

    ngOnDestroy(): void {
        this.gameSessionSocketService.disconnect();
    }

    selectGameSession(gameSessionId: string): void {
      this.selectedGameSessionId.set(gameSessionId);
    }

    isSelected(gameSessionId: string): boolean {
      return this.selectedGameSessionId() === gameSessionId;
    }
}
