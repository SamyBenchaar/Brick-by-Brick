import { Component } from '@angular/core';

interface Game {
    id: number;
    name: string;
    imageUrl: string;
    size: string;
    mode: string;
    date: string;
    description: string;
}

@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
})
export class AdminPageComponent {
    games: Game[] = [
        {
            id: 1,
            name: 'Nom du Jeu 1',
            imageUrl: 'https://via.placeholder.com/64',
            size: '2x2',
            mode: 'Multijoueur',
            date: '20/01/2026',
            description: 'Description du jeu qui apparaît au survol. Ce jeu est une aventure épique...',
        },
    ];

    editGame(game: Game): void {
        game.name = 'hi';
    }

    deleteGame(game: Game): void {
        game.name = 'deleted';
    }
}