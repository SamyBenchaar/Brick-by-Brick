import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { GameEvents } from '@common/game.events';
import { SocketService } from '@app/services/communication/socket/socket.service';

@Injectable({
    providedIn: 'root',
})
export class GameSocketService {
    games: WritableSignal<Game[]> = signal<Game[]>([]);

    private socketService = inject(SocketService);


    connect(): void {
        this.socketService.connect();
        this.setupEventListeners();
        this.requestGameList(false);
    }

    disconnect(): void {
        this.socketService.off(GameEvents.GameList);
        this.socketService.off(GameEvents.GameCreated);
        this.socketService.off(GameEvents.GameUpdated);
        this.socketService.off(GameEvents.GameDeleted);
        this.socketService.disconnect();
    }

    private setupEventListeners(): void {
        this.socketService.on<Game[]>(GameEvents.GameList, (games: Game[]) => {
            this.games.set(games);
        });

        this.socketService.on<Game>(GameEvents.GameCreated, (game: Game) => {
            this.games.update(currentGames => [...currentGames, game]);
        });

        this.socketService.on<Game>(GameEvents.GameUpdated, (updatedGame: Game) => {
            this.games.update(currentGames =>
                currentGames.map(game =>
                    game._id === updatedGame._id ? updatedGame : game,
                ),
            );
        });

        this.socketService.on<string>(GameEvents.GameDeleted, (gameId: string) => {
            this.games.update(currentGames =>
                currentGames.filter(game => game._id !== gameId),
            );
        });
    }

    requestGameList(visibleOnly = false): void {
        if (visibleOnly) {
            this.socketService.emit(GameEvents.RequestVisibleGameList);
        } else {
            this.socketService.emit(GameEvents.RequestGameList);
        }
    }

    getCurrentGames(): Game[] {
        return this.games();
    }
}
