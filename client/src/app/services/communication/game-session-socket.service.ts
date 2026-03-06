import { Injectable, signal, WritableSignal } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { GameSession } from '@common/gameSession';
import { SocketService } from './socket.service';

@Injectable({
    providedIn: 'root',
})
export class GameSessionSocketService {
    gameSessions: WritableSignal<GameSession[]> = signal<GameSession[]>([]);
    currentSession: WritableSignal<GameSession | null> = signal<GameSession | null>(null);
    playerSocketId: WritableSignal<string | null> = signal<string | null>(null);
    roomId: WritableSignal<string> = signal<string>('');
    hostSocketId: WritableSignal<string> = signal<string>('');
    mapCopy: WritableSignal<Game | null> = signal<Game | null>(null);
    private listenersSetup = false;

    constructor(private socketService: SocketService) {}

    connect(): void {
        if (!this.socketService.isConnected()) {
            this.socketService.connect();
        }

        // Get the player's socket ID after connection
        const socketId = this.socketService.getSocketId();
        if (socketId) {
            this.playerSocketId.set(socketId);
        }

        if (!this.listenersSetup) {
            this.setupEventListeners();
            this.listenersSetup = true;
        }
        this.requestGameSessionList();
    }

    disconnect(): void {
        this.socketService.off(GameSessionEvents.GameSessionList);
        this.socketService.off(GameSessionEvents.GameSessionCreated);
        this.socketService.off(GameSessionEvents.GameSessionUpdated);
        this.socketService.off(GameSessionEvents.GameSessionDeleted);
        this.socketService.off(GameSessionEvents.MapCopy);
    }

    private setupEventListeners(): void {
        this.socketService.on<GameSession[]>(GameSessionEvents.GameSessionList, (gameSessions) => {
            this.gameSessions.set(gameSessions);
        });

        this.socketService.on<GameSession>(GameSessionEvents.GameSessionCreated, (gameSession) => {
            this.gameSessions.update(current => [...current, gameSession]);
            if (!this.currentSession()) {
                this.currentSession.set(gameSession);
                this.roomId.set(gameSession.roomId);
                this.hostSocketId.set(gameSession.getHostSocketId());
            }
        });

        this.socketService.on<GameSession>(GameSessionEvents.GameSessionUpdated, (updatedSession) => {
            this.gameSessions.update(current =>
                current.map(gameSession => gameSession.roomId === updatedSession.roomId ? updatedSession : gameSession));
            if (this.currentSession()?.roomId === updatedSession.roomId) {
                this.currentSession.set(updatedSession);
                this.roomId.set(updatedSession.roomId);
                this.hostSocketId.set(updatedSession.getHostSocketId());
            }
            this.requestGameSessionList();
        });

        this.socketService.on<string>(GameSessionEvents.GameSessionDeleted, (deletedRoomId) => {
            this.gameSessions.update(current =>
                current.filter(gameSession => gameSession.roomId !== deletedRoomId));
            if (this.currentSession()?.roomId === deletedRoomId) {
                this.currentSession.set(null);
                this.roomId.set('');
                this.hostSocketId.set('');
            }
        });

        this.socketService.on<string>(GameSessionEvents.GameSessionJoinError, (message) => {
            alert(message);
        });

        this.socketService.on<string>(GameSessionEvents.GameSessionFull, (message) => {
            alert(message);
        });

        this.socketService.on<Game | null>(GameSessionEvents.MapCopy, (mapCopy) => {
            this.mapCopy.set(mapCopy);
        });
    }

    requestGameSessionList(): void {
        this.socketService.emit(GameSessionEvents.RequestGameSessionList);
    }

    requestMapCopy(roomId: string): void {
        this.mapCopy.set(null);
        this.socketService.emit(GameSessionEvents.RequestMapCopy, { roomId });
    }

    createGameSession(gameId: string, hostPlayer: Character): void {
        this.socketService.emit(GameSessionEvents.CreateGameSession, { gameId, hostPlayer });
    }

    joinGameSession(roomId: string, player: Character): void {
        this.socketService.emit(GameSessionEvents.JoinGameSession, { roomId, player });
    }

    leaveGameSession(): void {
        const currentRoomId = this.currentSession()?.roomId;
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.LeaveGameSession, { roomId: currentRoomId });
            this.currentSession.set(null);
            this.roomId.set('');
            this.hostSocketId.set('');
        }
    }

    getRoomId(): string {
        return this.currentSession()?.roomId || '';
    }

    getHostSocketId(): string {
        return this.currentSession()?.getHostSocketId() || '';
    }

    getPlayerSocketId(): string | null {
        return this.playerSocketId();
    }
}
