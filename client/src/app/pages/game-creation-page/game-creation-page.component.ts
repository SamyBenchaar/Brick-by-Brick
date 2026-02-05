import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication/communication.service';

@Component({
    selector: 'app--page',
    templateUrl: './game-creation-page.component.html',
    styleUrls: ['./game-creation-page.component.scss'],
    imports: [RouterLink],
})
export class GameCreationPageComponent {
    private communicationService = inject(CommunicationService);
    private router = inject(Router);

    games: Game[] = this.getVisibleGames();
    selectedGameId: string | null = null;

    getVisibleGames(): Game[] {
        this.communicationService.getVisibleGames().subscribe((games) => {
            this.games = games;
        });
        return this.games;
    }

    selectGame(gameId: string): void {
        this.selectedGameId = gameId;
    }

    createGameSession(): void {
        if (this.selectedGameId) {
            this.communicationService.createGameSession(this.selectedGameId).subscribe(() => {
                this.router.navigate(['/character-creation']);
            });
        }
    }
}