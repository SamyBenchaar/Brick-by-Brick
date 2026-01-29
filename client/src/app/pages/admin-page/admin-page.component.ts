import { CommonModule, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication/communication.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    imports: [CommonModule, DatePipe, FormsModule],
})
export class AdminPageComponent {
    showGameCreationModal = false;
    selectedSize: 'small' | 'medium' | 'large' | null = null;
    gameMode: 'classic' | 'ctf' = 'classic';

    gameModes = [
        { value: 'classic' as const, label: 'classique' },
        { value: 'ctf' as const, label: 'CTF' },
    ];

    gameSizes = [
        {
            id: 'small' as const,
            label: 'Petite',
            gridSize: '10x10',
            players: '2 joueurs',
            width: 10,
            height: 10,
        },
        {
            id: 'medium' as const,
            label: 'Moyenne',
            gridSize: '15x15',
            players: '2 à 4 joueurs',
            width: 15,
            height: 15,
        },
        {
            id: 'large' as const,
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

    selectSize(size: 'small' | 'medium' | 'large'): void {
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