import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GAME_MODES_DISPLAY, GAME_SIZES_DISPLAY, GameModeValue, GameSizeId, getGameSizeLabel } from '@app/constants/game-config-constants';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication/communication.service';

@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    imports: [CommonModule, FormsModule, RouterLink],
})
export class AdminPageComponent implements OnInit {
    private communicationService = inject(CommunicationService);
    private router = inject(Router);

    readonly gameSizes = GAME_SIZES_DISPLAY;
    readonly gameModes = GAME_MODES_DISPLAY;

    showGameCreationModal = false;
    selectedSize: GameSizeId | null = null;
    selectedGameMode: GameModeValue = 'classic';
    games: Game[] = [];

    ngOnInit(): void {
        this.loadGames();
    }

    private loadGames(): void {
        this.communicationService.getAllGames().subscribe((games) => {
            this.games = games;
        });
    }

    editGame(game: Game): void {
        this.communicationService.updateGameVisibility(game._id, !game.isVisible).subscribe((updatedGame) => {
            game.isVisible = updatedGame.isVisible;
        });
    }

    deleteGame(game: Game): void {
        this.communicationService.deleteGame(game._id).subscribe({
            next: () => {
                this.games = this.games.filter(g => g._id !== game._id);
                alert('Jeu supprimé avec succès !');
            },
            error: (err) => {
                alert(`Erreur: ${err.error?.message || 'Impossible de supprimer ce jeu'}`);
            },
        });
    }

    openGameCreationModal(): void {
        this.showGameCreationModal = true;
        this.selectedSize = null;
        this.selectedGameMode = 'classic';
    }

    closeGameCreationModal(): void {
        this.showGameCreationModal = false;
        this.selectedSize = null;
        this.selectedGameMode = 'classic';
    }

    selectSize(size: GameSizeId): void {
        this.selectedSize = size;
    }

    getGameSizeLabel(sizeId: string): string {
        return getGameSizeLabel(sizeId);
    }

    confirmAndRedirect(): void {
        if (this.selectedSize) {
            this.router.navigate(['/edition'], {
                queryParams: {
                    size: this.selectedSize,
                    mode: this.selectedGameMode,
                },
            });
        }
    }
}