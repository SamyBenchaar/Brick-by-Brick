import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameSessionListComponent } from '@app/components/game-session-list/game-session-list.component';
import { inject } from '@angular/core';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';

@Component({
  selector: 'app-join-game-page',
  imports: [RouterLink, GameSessionListComponent],
  templateUrl: './join-game-page.component.html',
  styleUrl: './join-game-page.component.scss',
})
export class JoinGamePageComponent {
    private sessionSocket = inject(GameSessionSocketService);

    join(roomId: string, playerId: string): void {
      this.sessionSocket.joinGameSession(roomId, playerId);
    }

}
