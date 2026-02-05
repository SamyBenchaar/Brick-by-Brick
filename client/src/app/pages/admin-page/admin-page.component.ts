import { CommonModule, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication/communication.service';


@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    imports: [CommonModule, DatePipe, FormsModule, RouterLink],
})
export class AdminPageComponent {
    showGameCreationModal = false;
    selectedSize: 'Small' | 'Medium' | 'Large' | null = null;
    gameMode: 'classic' | 'ctf' = 'classic';

    gameModes = [
        { value: 'classic' as const, label: 'classique' },
        { value: 'ctf' as const, label: 'CTF' },
    ];

    gameSizes = [
        {
            id: 'Small' as const,
            label: 'Petite',
            gridSize: '10x10',
            players: '2 joueurs',
            width: 10,
            height: 10,
        },
        {
            id: 'Medium' as const,
            label: 'Moyenne',
            gridSize: '15x15',
            players: '2 à 4 joueurs',
            width: 15,
            height: 15,
        },
        {
            id: 'Large' as const,
            label: 'Grande',
            gridSize: '20x20',
            players: '2 à 6 joueurs',
            width: 20,
            height: 20,
        },
    ];


    constructor(
        private communicationService: CommunicationService,
        private router: Router,
    ) {}

    games: Game[] = this.getAllGamesAdmin();

    getAllGamesAdmin(): Game[] {
        this.communicationService.getAllGamesAdmin().subscribe((games) => {
            this.games = games;
        });
        return this.games;
    }

    editGame(game: Game): void {
        this.communicationService.updateGameVisibility(game._id, !game.isVisible).subscribe((updatedGame) => {
            game.isVisible = updatedGame.isVisible;
        });
    }

    deleteGame(game: Game): void {
        this.communicationService.deleteGame(game._id).subscribe(() => {
            this.games = this.games.filter(g => g._id !== game._id);
        });
    }

    openGameCreationModal(): void {
        this.showGameCreationModal = true;
        this.selectedSize = null;
        this.gameMode = 'classic';
    }

    closeGameCreationModal(): void {
        this.showGameCreationModal = false;
        this.selectedSize = null;
        this.gameMode = 'classic';
    }

    selectSize(size: 'Small' | 'Medium' | 'Large'): void {
        this.selectedSize = size;
    }

    confirmAndRedirect(): void {
        if (this.selectedSize) {
            this.router.navigate(['/edition'], {
                queryParams: {
                    size: this.selectedSize,
                    mode: this.gameMode,
                },
            });
        }
    }
}