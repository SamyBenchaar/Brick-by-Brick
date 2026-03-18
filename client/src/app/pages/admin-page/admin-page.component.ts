import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GameListComponent } from '@app/components/game-list/game-list.component';
import { GameListMode } from '@app/constants/game-list-mode.enum';
import { GAME_MODES_DISPLAY, GAME_SIZES_DISPLAY, GameModeValue, GameSizeId } from '@common/constants/game-config-constants';

@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    imports: [CommonModule, FormsModule, RouterLink, GameListComponent],
})
export class AdminPageComponent {
    private router = inject(Router);

    readonly gameSizes = GAME_SIZES_DISPLAY;
    readonly gameModes = GAME_MODES_DISPLAY;
    readonly gameListMode = GameListMode;

    showGameCreationModal = false;
    selectedSize: GameSizeId | null = null;
    selectedGameMode: GameModeValue = 'classic';

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