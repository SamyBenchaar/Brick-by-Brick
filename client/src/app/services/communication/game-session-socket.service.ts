import { Injectable, signal, WritableSignal } from '@angular/core';
import { SocketService } from './socket.service';
import { GameSession } from '@common/gameSession';
import { GameSessionEvents } from '@common/game.events';
import { Character } from '@common/character';

@Injectable({
    providedIn: 'root',
})
export class GameSessionSocketService {
    gameSessions: WritableSignal<GameSession[]> = signal<GameSession[]>([]);

    constructor(private socketService: SocketService) {}

    connect(): void {
        if (!this.socketService.isConnected()) {
            this.socketService.connect();
        }

        this.setupEventListeners();
        this.requestGameSessionList();
    }

    disconnect(): void {
        this.socketService.off(GameSessionEvents.GameSessionList);
        this.socketService.off(GameSessionEvents.GameSessionCreated);
        this.socketService.off(GameSessionEvents.GameSessionUpdated);
        this.socketService.off(GameSessionEvents.GameSessionDeleted);
        this.socketService.disconnect();
    }

    private setupEventListeners(): void {
        this.socketService.on<GameSession[]>(GameSessionEvents.GameSessionList, (gameSessions) => {
            this.gameSessions.set(gameSessions);
        });
    }

    requestGameSessionList(): void {
        this.socketService.emit(GameSessionEvents.RequestGameSessionList);
    }

    createGameSession(gameId: string, hostPlayer: Character): void {
        this.socketService.emit(GameSessionEvents.CreateGameSession, { gameId, hostPlayer });
    }

    onGameSessionCreated(callback: (gameSession: GameSession) => void) {
        this.socketService.on<GameSession>(GameSessionEvents.GameSessionCreated, (gameSession) => {
            callback(gameSession);
        });
    }

    joinGameSession(roomId: string, player: Character): void {
        this.socketService.emit(GameSessionEvents.JoinGameSession, { roomId, player });
    }

    leaveGameSession(roomId: string, playerId: string): void {
        this.socketService.emit(GameSessionEvents.LeaveGameSession, { roomId, playerId });
    }
}
