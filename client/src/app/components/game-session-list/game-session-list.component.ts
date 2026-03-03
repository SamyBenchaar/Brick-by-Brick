import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';

@Component({
  selector: 'app-game-session-list',
  imports: [],
  templateUrl: './game-session-list.component.html',
  styleUrl: './game-session-list.component.scss',
})
export class GameSessionListComponent {
    private gameSessionSocketService = inject(GameSessionSocketService);

    ngOnInit(): void {
      this.gameSessionSocketService.connect();
    }

    ngOnDestroy(): void {
        this.gameSessionSocketService.disconnect();
    }

    getAvailableGameSessions() {
        return this.gameSessionSocketService.gameSessions();
    }
}
