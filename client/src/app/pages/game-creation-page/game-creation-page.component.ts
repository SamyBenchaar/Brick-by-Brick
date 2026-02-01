import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommunicationService } from '@app/services/communication/communication.service';
import { Game } from '@app/interfaces/game';

@Component({
    selector: 'app--page',
    templateUrl: './game-creation-page.component.html',
    styleUrls: ['./game-creation-page.component.scss'],
    imports: [RouterLink]
})
export class GameCreationPageComponent {
    constructor(private communicationService: CommunicationService) {}

    games: Game[] = this.getVisibleGames();

    getVisibleGames(): Game[] {
        this.communicationService.getVisibleGames().subscribe((games) => {
            this.games = games;
        });
        return this.games;
    }
}