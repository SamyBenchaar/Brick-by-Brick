import { Component, ViewChild, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameSessionListComponent } from '@app/components/game-session-list/game-session-list.component';

@Component({
  selector: 'app-join-game-page',
  imports: [RouterLink, GameSessionListComponent],
  templateUrl: './join-game-page.component.html',
  styleUrl: './join-game-page.component.scss',
})
export class JoinGamePageComponent {
  @ViewChild(GameSessionListComponent) gameSessionListComponent!: GameSessionListComponent;
  private router = inject(Router);

  join(): void {
    const selectedGameSessionId = this.gameSessionListComponent?.selectedGameSessionId();
    if (selectedGameSessionId) {
      this.router.navigate(['/character-creation'], { queryParams: { roomId: selectedGameSessionId } });
    }
  }

  canJoinGameSession(): boolean {
    return !!this.gameSessionListComponent?.selectedGameSessionId();
  }

}
