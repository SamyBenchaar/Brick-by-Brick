import { Component } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommunicationService } from '@app/services/communication/communication.service';
import { Game } from '@app/interfaces/game';

@Component({
    selector: 'app--page',
    templateUrl: './game-creation-page.component.html',
    styleUrls: ['./game-creation-page.component.scss'],
    imports: [RouterLink]
})
export class GameCreationPageComponent {
    constructor(
        private communicationService: CommunicationService,
        private router: Router
    ) {}

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
            this.communicationService.createGameSession(this.selectedGameId).subscribe((gameSession) => {
                this.router.navigate(['/character-creation'])
            });
        }
    }
}