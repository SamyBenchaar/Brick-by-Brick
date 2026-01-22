import { DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication/communication.service';

@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    imports: [DatePipe],
})
export class AdminPageComponent {

    constructor(private communicationService: CommunicationService) {}
    games: Game[] = this.getAllGames();

    getAllGames(): Game[] {
        this.communicationService.getAllGames().subscribe((games) => {
            this.games = games;
        });
        return this.games;
    }

    editGame(game: Game): void {
        this.communicationService.updateGame(game._id, { isVisible: !game.isVisible }).subscribe((updatedGame) => {
            game.isVisible = updatedGame.isVisible;
        });
    }

    deleteGame(game: Game): void {
        this.communicationService.deleteGame(game._id).subscribe(() => {
            this.games = this.games.filter(g => g._id !== game._id);
        });
    }
}