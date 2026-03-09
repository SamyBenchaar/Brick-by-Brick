import { CommonModule } from '@angular/common';
import { Component, computed, inject, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication/communication.service';
import { GameSocketService } from '@app/services/communication/game-socket.service';
import { getGameModeLabel, getGameSizeLabel } from '@common/constants/game-config-constants';
@Component({
    selector: 'app-game-list',
    templateUrl: './game-list.component.html',
    styleUrls: ['./game-list.component.scss'],
    imports: [CommonModule, RouterLink],
})
export class GameListComponent implements OnInit, OnDestroy {
    @Input() mode: 'creation' | 'admin' = 'creation';
    @Input() showOnlyVisible = true;

    private communicationService = inject(CommunicationService);
    private gameSocketService = inject(GameSocketService);
    private dialog = inject(MatDialog);

    selectedGameId = signal<string | null>(null);
    hoveredGameId = signal<string | null>(null);

    filteredGames = computed(() => {
        const allGames = this.gameSocketService.games();
        if (this.showOnlyVisible) {
            return allGames.filter(game => game.isVisible);
        }
        return allGames;
    });

    ngOnInit(): void {
        this.gameSocketService.connect();
        this.gameSocketService.requestGameList(this.showOnlyVisible);
    }

    ngOnDestroy(): void {
        // this.gameSocketService.disconnect();
    }

    getGameModeLabel(mode: string): string {
        return getGameModeLabel(mode);
    }

    getGameSizeLabel(size: string): string {
        return getGameSizeLabel(size);
    }

    selectGame(gameId: string): void {
        if (this.mode !== 'creation') {
            return;
        }
        this.selectedGameId.set(gameId);
    }

    getSelectedGameId(): string | null {
        return this.selectedGameId();
    }

    onImageEnter(gameId: string): void {
        this.hoveredGameId.set(gameId);
    }

    onImageLeave(): void {
        this.hoveredGameId.set(null);
    }

    isSelected(gameId: string): boolean {
        return this.selectedGameId() === gameId;
    }

    isHovered(gameId: string): boolean {
        return this.hoveredGameId() === gameId;
    }

    toggleVisibility(game: Game, event: Event): void {
        event.stopPropagation();
        this.communicationService.updateGameVisibility(game._id, !game.isVisible).subscribe({
            next: (updated) => {
                this.gameSocketService.games.update(current =>
                    current.map(g => (g._id === updated._id ? updated : g)),
                );
            },
            error: (err) => {
                this.dialog.open(AppDialogComponent, {
                    data: {
                        title: 'Erreur',
                        message: err.error?.message || 'Impossible de modifier la visibilité',
                        type: 'error',
                    },
                });
            },
        });
    }

    deleteGame(game: Game, event: Event): void {
        event.stopPropagation();
        const dialogRef = this.dialog.open(AppDialogComponent, {
            data: {
                title: 'Confirmation de suppression',
                message: `Êtes-vous sûr de vouloir supprimer le jeu "${game.name}" ?`,
                type: 'warning',
            },
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                this.communicationService.deleteGame(game._id).subscribe({
                    next: () => {
                        this.dialog.open(AppDialogComponent, {
                            data: {
                                title: 'Succès',
                                message: 'Jeu supprimé avec succès !',
                                type: 'success',
                            },
                        });
                    },
                    error: (err) => {
                        this.dialog.open(AppDialogComponent, {
                            data: {
                                title: 'Erreur',
                                message: err.error?.message || 'Impossible de supprimer ce jeu',
                                type: 'error',
                            },
                        });
                    },
                });
            }
        });
    }
}
