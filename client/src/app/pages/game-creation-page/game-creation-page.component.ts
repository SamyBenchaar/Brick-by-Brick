import { Component, inject, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameListComponent } from '@app/components/game-list/game-list.component';
// import { CommunicationService } from '@app/services/communication/communication.service';

@Component({
    selector: 'app--page',
    templateUrl: './game-creation-page.component.html',
    styleUrls: ['./game-creation-page.component.scss'],
    imports: [RouterLink, GameListComponent],
})
export class GameCreationPageComponent {
    @ViewChild(GameListComponent) gameListComponent!: GameListComponent;

    // private communicationService = inject(CommunicationService);
    private router = inject(Router);

    createGameSession(): void {
        //cette méthode sera implémenté au sprint 2
        // const selectedGameId = this.gameListComponent?.getSelectedGameId();
        // if (selectedGameId) {
        //     this.communicationService.createGameSession(selectedGameId).subscribe(() => {
        //         this.router.navigate(['/character-creation']);
        //     });
        // }
        this.router.navigate(['/character-creation']);
    }

    get canCreateSession(): boolean {
        return !!this.gameListComponent?.getSelectedGameId();
    }
}