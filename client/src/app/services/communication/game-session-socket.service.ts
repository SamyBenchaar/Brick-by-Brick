import { Injectable, signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { Game } from '@app/interfaces/game';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { GameSession } from '@common/game-session/gameSession';
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

    private listenersInitialized = false;
    kickedMessage: WritableSignal<string | null> = signal<string | null>(null);
    cancelledMessage: WritableSignal<string | null> = signal<string | null>(null);
    takenAvatars: WritableSignal<number[]> = signal<number[]>([]);

    constructor(
        private socketService: SocketService,
        private router: Router,
        private dialog: MatDialog,
    ) {}

    connect(): void {
        if (!this.socketService.isConnected()) {
            this.socketService.connect();
        }

        if (!this.listenersInitialized) {
            this.setupEventListeners();
            this.listenersInitialized = true;
        }
        this.requestGameSessionList();
    }

    disconnect(): void {
        this.listenersInitialized = false;
        this.socketService.off(GameSessionEvents.GameSessionList);
        this.socketService.off(GameSessionEvents.GameSessionListUpdated);
        this.socketService.off(GameSessionEvents.GameSessionCreated);
        this.socketService.off(GameSessionEvents.GameSessionUpdated);
        this.socketService.off(GameSessionEvents.GameSessionDeleted);
        this.socketService.off(GameSessionEvents.GameSessionJoinError);
        this.socketService.off(GameSessionEvents.PlayerKicked);
        this.socketService.off(GameSessionEvents.RoomCancelled);
        this.socketService.off(GameSessionEvents.GameStarted);
        this.socketService.off(GameSessionEvents.AvatarTakenUpdated);
        this.socketService.disconnect();
    }

    private setupEventListeners(): void {
        this.socketService.on<GameSession[]>(GameSessionEvents.GameSessionList, (gameSessions) => {
            this.gameSessions.set(gameSessions);
        });

        this.socketService.on<GameSession[]>(GameSessionEvents.GameSessionListUpdated, (gameSessions) => {
            this.gameSessions.set(gameSessions);
        });

        this.socketService.on<GameSession>(GameSessionEvents.GameSessionCreated, (gameSession) => {
            this.gameSessions.update(current => [...current, gameSession]);
            if (!this.currentSession()) {
                this.currentSession.set(gameSession);
                this.takenAvatars.set(gameSession.takenAvatars);
            }
        });

        this.socketService.on<GameSession>(GameSessionEvents.GameSessionUpdated, (updatedSession) => {
            this.gameSessions.update(current =>
                current.map(gameSession => gameSession.roomId === updatedSession.roomId ? updatedSession : gameSession));
            const mySocketId = this.socketService.getSocketId();
            const isCurrentPlayerInSession = updatedSession.players.find(p => p.socketId === mySocketId);

            if (isCurrentPlayerInSession) {
                this.currentSession.set(updatedSession);
                this.takenAvatars.set(updatedSession.takenAvatars);
            }
            this.requestGameSessionList();
        });

        this.socketService.on<string>(GameSessionEvents.GameSessionDeleted, (deletedRoomId) => {
            this.gameSessions.update(current =>
                current.filter(gameSession => gameSession.roomId !== deletedRoomId));
            if (this.currentSession()?.roomId === deletedRoomId) {
                this.currentSession.set(null);
                this.takenAvatars.set([]);
            }
        });

        this.socketService.on<string>(GameSessionEvents.GameSessionJoinError, (message) => {
            alert(message);
        });

        this.socketService.on<{ message: string }>(GameSessionEvents.PlayerKicked, (data) => {
            this.currentSession.set(null);
            this.router.navigate(['/']).then(() => {
                this.dialog.open(AppDialogComponent, {
                    data: { title: 'Exclu de la salle', message: data.message, type: 'error' },
                    disableClose: true,
                });
            });
        });

        this.socketService.on<{ message: string }>(GameSessionEvents.RoomCancelled, (data) => {
            this.currentSession.set(null);
            this.router.navigate(['/']).then(() => {
                this.dialog.open(AppDialogComponent, {
                    data: { title: 'Salle annulée', message: data.message, type: 'info' },
                    disableClose: true,
                });
            });
        });

        this.socketService.on<{ roomId: string; mapData: Game; gameSession: GameSession }>(GameSessionEvents.GameStarted, (payload) => {
            const { roomId, mapData, gameSession } = payload;
            this.currentSession.set(gameSession);
            this.mapCopy.set(mapData);
            this.router.navigate(['/game-view'], { queryParams: { roomId } });
        });

        this.socketService.on<number[]>(GameSessionEvents.AvatarTakenUpdated, (avatarIds) => {
            this.takenAvatars.set(avatarIds);
        });
    }

    requestGameSessionList(): void {
        this.socketService.emit(GameSessionEvents.RequestGameSessionList);
    }


    createGameSession(gameId: string, hostPlayer: Character): void {
        this.socketService.emit(GameSessionEvents.CreateGameSession, { gameId, hostPlayer });
    }

    joinGameSession(roomId: string, player: Character): void {
        this.socketService.emit(GameSessionEvents.JoinGameSession, { roomId, player });
    }

    observeGameSession(roomId: string) {
        this.socketService.emit(GameSessionEvents.ObserveGameSession, { roomId });
    }

    kickPlayer(targetId: string): void {
        const currentRoomId = this.currentSession()?.roomId;
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.KickPlayer, { roomId: currentRoomId, targetId });
        }
    }

    leaveGameSession(): void {
        const currentRoomId = this.currentSession()?.roomId;
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.LeaveGameSession, { roomId: currentRoomId });
            this.currentSession.set(null);
        }
    }

    updateTakenAvatars(roomId: string, newAvatarId: number, previousAvatarId: number | null): void {
        this.socketService.emit(GameSessionEvents.AvatarTakenUpdated, { roomId, newAvatarId, previousAvatarId });
    }

    startGame(): void {
        const currentRoomId = this.currentSession()?.roomId;
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.StartGame, { roomId: currentRoomId });
        }
    }

    getSocketId(): string {
        return this.socketService.getSocketId() ?? '';
    }

    isConnected(): boolean {
        return this.socketService.isConnected();
    }

    isCurrentUserHost(): boolean {
        const session = this.currentSession();
        return session?.players[0]?.socketId === this.getSocketId();
    }

    isPlayerHost(socketId: string): boolean {
        return this.currentSession()?.players[0]?.socketId === socketId;
    }

    canStartGame(): boolean {
        const session = this.currentSession();
        return this.isCurrentUserHost() && (session?.players.length ?? 0) >= 2;
    }
}

