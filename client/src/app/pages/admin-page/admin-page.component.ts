import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GameListComponent } from '@app/components/game-list/game-list.component';

@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    imports: [CommonModule, FormsModule, GameListComponent, RouterLink],
})
export class AdminPageComponent {
    private router = inject(Router);

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