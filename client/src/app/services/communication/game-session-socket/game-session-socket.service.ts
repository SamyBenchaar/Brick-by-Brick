import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { Game } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { setupGameplayEventListeners } from '@app/services/communication/gameplay-listeners/gameplay-listeners';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { VirtualPlayerProfile } from '@common/virtual.player.profile';
import { GamePlaySocketService } from './game-play-socket.service';

@Injectable({
    providedIn: 'root',
})
export class GameSessionSocketService {
    gameSessions: WritableSignal<GameSession[]> = signal<GameSession[]>([]);
    currentSession: WritableSignal<GameSession | null> = signal<GameSession | null>(null);
    roomId: WritableSignal<string> = signal<string>('');
    hostSocketId: WritableSignal<string> = signal<string>('');
    hasAbandoned: WritableSignal<boolean> = signal<boolean>(false);

    private listenersInitialized = false;
    kickedMessage: WritableSignal<string | null> = signal<string | null>(null);
    cancelledMessage: WritableSignal<string | null> = signal<string | null>(null);
    takenAvatars: WritableSignal<number[]> = signal<number[]>([]);
    private lastJoinRoomId: string | null = null;
    private lastJoinPlayer: Character | null = null;
    readonly endGameDelay = 3000;

    private socketService = inject(SocketService);
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private gamePlaySocketService = inject(GamePlaySocketService);

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
        this.socketService.off(GameSessionEvents.PlayerAbandoned);
        this.socketService.off(GameSessionEvents.GameEnded);
        this.socketService.off(GameSessionEvents.AvatarTakenUpdated);

        this.gamePlaySocketService.resetGameplayState();
        this.currentSession.set(null);
        this.takenAvatars.set([]);
        this.hasAbandoned.set(false);
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
            }
        });

        this.socketService.on<GameSession>(GameSessionEvents.GameSessionUpdated, (updatedSession) => {
            this.gameSessions.update(current =>
                current.map(gameSession => gameSession.roomId === updatedSession.roomId ? updatedSession : gameSession));
            const mySocketId = this.socketService.getSocketId();
            const isCurrentPlayerInSession = updatedSession.players.find(p => p.socketId === mySocketId);

            if (isCurrentPlayerInSession) {
                this.currentSession.set(updatedSession);
            }
            this.requestGameSessionList();
        });

        this.socketService.on<string>(GameSessionEvents.GameSessionDeleted, (deletedRoomId) => {
            this.gameSessions.update(current =>
                current.filter(gameSession => gameSession.roomId !== deletedRoomId));
            if (this.currentSession()?.roomId === deletedRoomId) {
                this.currentSession.set(null);
                this.gamePlaySocketService.resetGameplayState();
                this.hasAbandoned.set(false);
                this.takenAvatars.set([]);
            }
        });

        this.socketService.on<string>(GameSessionEvents.GameSessionJoinError, (message) => {
            const dialogRef = this.dialog.open(AppDialogComponent, {
                data: {
                    title: 'Erreur de jointure',
                    message,
                    type: 'warning',
                    confirmText: 'Réessayer',
                    cancelText: "Retour a l'accueil",
                },
                disableClose: true,
            });

            dialogRef.afterClosed().subscribe((retry) => {
                if (retry && this.lastJoinPlayer && this.lastJoinRoomId) {
                    this.joinGameSession(this.lastJoinRoomId, this.lastJoinPlayer);
                } else {
                    this.router.navigate(['/']);
                }
            });
        });

        this.socketService.on<{ message: string }>(GameSessionEvents.PlayerKicked, (data) => {
            this.currentSession.set(null);
            this.gamePlaySocketService.resetGameplayState();
            this.takenAvatars.set([]);
            this.hasAbandoned.set(false);
            this.router.navigate(['/']).then(() => {
                this.dialog.open(AppDialogComponent, {
                    data: { title: 'Exclu de la salle', message: data.message, type: 'error' },
                    disableClose: true,
                });
            });
        });

        this.socketService.on<{ message: string }>(GameSessionEvents.RoomCancelled, (data) => {
            this.currentSession.set(null);
            this.gamePlaySocketService.resetGameplayState();
            this.takenAvatars.set([]);
            this.hasAbandoned.set(false);
            this.router.navigate(['/']).then(() => {
                this.dialog.open(AppDialogComponent, {
                    data: { title: 'Salle annulée', message: data.message, type: 'info' }, disableClose: true,
                });
            });
        });

        this.socketService.on<{ roomId: string; mapData: Game; gameSession: GameSession }>(GameSessionEvents.GameStarted, (payload) => {
            const { roomId, mapData, gameSession } = payload;

            const mySocketId = this.socketService.getSocketId();
            const isPlayer = gameSession.players.some(p => p.socketId === mySocketId);
            if (!isPlayer) {
                this.dialog.open(AppDialogComponent, {
                    data: {
                        title: 'La partie a commencé',
                        message: "La partie a commencé avant que vous ne rejoigniez. Vous retournez à l'accueil",
                        type: 'info',
                        confirmText: 'OK',
                    },
                });
                this.router.navigate(['/']);
                return;
            }

            this.hasAbandoned.set(false);
            this.gamePlaySocketService.resetGameplayState();

            this.currentSession.set(gameSession);
            this.gamePlaySocketService.mapCopy.set(mapData);
            this.router.navigate(['/game-view'], { queryParams: { roomId } });
        });

        setupGameplayEventListeners(this.gamePlaySocketService, this, this.socketService, this.router, this.dialog);

        this.socketService.on<number[]>(GameSessionEvents.AvatarTakenUpdated, (avatarIds) => {
            this.takenAvatars.set(avatarIds);
        });


    }

    requestGameSessionList(): void {
        this.socketService.emit(GameSessionEvents.RequestGameSessionList);
    }

    createGameSession(gameId: string, hostPlayer: Character): void {
        this.takenAvatars.set([]);
        this.socketService.emit(GameSessionEvents.CreateGameSession, { gameId, hostPlayer });
    }

    joinGameSession(roomId: string, player: Character): void {
        this.lastJoinPlayer = player;
        this.lastJoinRoomId = roomId;
        this.socketService.emit(GameSessionEvents.JoinGameSession, { roomId, player });
    }

    observeGameSession(roomId: string) {
        this.socketService.emit(GameSessionEvents.ObserveGameSession, { roomId });
    }

    kickPlayer(targetId: string): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.KickPlayer, { roomId: currentRoomId, targetId });
        }
    }

    addVirtualPlayer(profile: VirtualPlayerProfile): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.AddVirtualPlayer, { roomId: currentRoomId, profile });
        }
    }

    leaveGameSession(): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.LeaveGameSession, { roomId: currentRoomId });
        }

        this.currentSession.set(null);
        this.takenAvatars.set([]);
        this.hasAbandoned.set(false);
        this.gamePlaySocketService.resetGameplayState();
    }

    updateTakenAvatars(roomId: string, newAvatarId: number): void {
        this.socketService.emit(GameSessionEvents.AvatarTakenUpdated, { roomId, newAvatarId });
    }

    startGame(): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.StartGame, { roomId: currentRoomId });
        }
    }

    abandonGame(): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.hasAbandoned.set(true);
            this.socketService.emit(GameSessionEvents.PlayerAbandoned, { roomId: currentRoomId });
        }

        this.currentSession.set(null);
        this.takenAvatars.set([]);
        this.gamePlaySocketService.resetGameplayState();
        this.router.navigate(['/']);
    }

    getSocketId(): string {
        return this.socketService.getSocketId() ?? '';
    }

    getRoomId(): string | undefined {
        return this.currentSession()?.roomId;
    }

    isConnected(): boolean {
        return this.socketService.isConnected();
    }

    isCurrentUserHost(): boolean {
        const session = this.currentSession();
        return session?.host?.socketId === this.getSocketId();
    }

    isPlayerHost(socketId: string): boolean {
        return this.currentSession()?.host?.socketId === socketId;
    }

    canStartGame(): boolean {
        const session = this.currentSession();
        return this.isCurrentUserHost() && (session?.players?.length ?? 0) >= 2;
    }
}
