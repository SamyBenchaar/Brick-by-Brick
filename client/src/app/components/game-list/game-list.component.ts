import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication/communication.service';

@Component({
    selector: 'app-game-list',
    templateUrl: './game-list.component.html',
    styleUrls: ['./game-list.component.scss'],
    imports: [CommonModule, RouterLink],
})
export class GameListComponent implements OnInit {
    @Input() mode: 'creation' | 'admin' = 'creation';
    @Input() showOnlyVisible = true;
    @Output() gameSelected = new EventEmitter<string>();
    @Output() gameVisibilityToggled = new EventEmitter<Game>();
    @Output() gameDeleted = new EventEmitter<Game>();

    private communicationService = inject(CommunicationService);

    games: Game[] = [];
    selectedGameId: string | null = null;
    filteredGames = signal<Game[]>([]);
    hoveredGameId: string | null = null;

    ngOnInit(): void {
        this.loadGames();
    }

    loadGames(): void {
        if (this.mode === 'admin') {
            this.communicationService.getAllGamesAdmin().subscribe((games) => {
                this.games = games;
                this.updateFilteredGames();
            });
        } else {
            this.communicationService.getVisibleGames().subscribe((games) => {
                this.games = games;
                this.updateFilteredGames();
            });
        }
    }

    updateFilteredGames(): void {
        if (this.showOnlyVisible) {
            this.filteredGames.set(this.games.filter(game => game.isVisible));
        } else {
            this.filteredGames.set(this.games);
        }
    }

    selectGame(gameId: string): void {
        if (this.mode !== 'creation') {
            return;
        }

        this.selectedGameId = gameId;
        this.gameSelected.emit(gameId);
    }

    onImageEnter(gameId: string): void {
        this.hoveredGameId = gameId;
    }

    onImageLeave(): void {
        this.hoveredGameId = null;
    }

    isSelected(gameId: string): boolean {
        return this.selectedGameId === gameId;
    }

    toggleVisibility(game: Game, event: Event): void {
        event.stopPropagation();
        this.communicationService.updateGameVisibility(game._id, !game.isVisible).subscribe({
            next: (updatedGame) => {
                game.isVisible = updatedGame.isVisible;
                this.gameVisibilityToggled.emit(game);
                this.updateFilteredGames();
            },
            error: (err) => {
                alert(`Erreur: ${err.error?.message || 'Impossible de modifier la visibilité'}`);
            },
        });
    }

    deleteGame(game: Game, event: Event): void {
        event.stopPropagation();
        if (confirm(`Êtes-vous sûr de vouloir supprimer le jeu "${game.name}" ?`)) {
            this.gameDeleted.emit(game);
        }
    }
}
