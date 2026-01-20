import { Component } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication.service';

@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    imports: [],
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
        this.communicationService.updateGame(game._id, { isVisible: !game.isVisible });
    }

    deleteGame(game: Game): void {
        this.communicationService.deleteGame(game._id);
    }
}