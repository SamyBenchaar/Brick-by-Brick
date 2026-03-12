import { Component, inject, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameListComponent } from '@app/components/game-list/game-list.component';
import { GameListMode } from '@app/constants/game-list-mode.enum';

@Component({
    selector: 'app-game-creation-page',
    templateUrl: './game-creation-page.component.html',
    styleUrls: ['./game-creation-page.component.scss'],
    imports: [RouterLink, GameListComponent],
})
export class GameCreationPageComponent {
    @ViewChild(GameListComponent) gameListComponent!: GameListComponent;

    private router = inject(Router);
    readonly gameListMode = GameListMode;

    createGameSession(): void {
        const selectedGameId = this.gameListComponent?.getSelectedGameId();
        if (selectedGameId) {
            this.router.navigate(['/character-creation'], { queryParams: { gameId: selectedGameId } });
        };
    }

    get canCreateSession(): boolean {
        return !!this.gameListComponent?.getSelectedGameId();
    }
}