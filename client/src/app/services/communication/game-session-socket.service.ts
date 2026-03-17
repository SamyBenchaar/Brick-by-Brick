import { Injectable, signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { Game } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { Position } from '@common/position';
import { setupGameplayEventListeners } from './gameplay-listeners';
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
    currentPlayerTurn: WritableSignal<string | null> = signal<string | null>(null);
    turnTimeRemaining: WritableSignal<number> = signal<number>(0);
    reachableTiles: WritableSignal<Position[]> = signal<Position[]>([]);
    gameEnded: WritableSignal<boolean> = signal<boolean>(false);
    turnStarting: WritableSignal<boolean> = signal<boolean>(false);
    hasAbandoned: WritableSignal<boolean> = signal<boolean>(false);
    isDebugModeActivated: WritableSignal<boolean> = signal<boolean>(false);

    private listenersInitialized = false;
    kickedMessage: WritableSignal<string | null> = signal<string | null>(null);
    cancelledMessage: WritableSignal<string | null> = signal<string | null>(null);
    takenAvatars: WritableSignal<number[]> = signal<number[]>([]);
    private lastJoinRoomId: string | null = null;
    private lastJoinPlayer: Character | null = null;
    readonly endGameDelay = 3000;
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
        this.socketService.off(GameSessionEvents.TurnStarting);
        this.socketService.off(GameSessionEvents.TurnStarted);
        this.socketService.off(GameSessionEvents.TurnTimeUpdate);
        this.socketService.off(GameSessionEvents.TurnEnded);
        this.socketService.off(GameSessionEvents.MoveExecuted);
        this.socketService.off(GameSessionEvents.ReachableTiles);
        this.socketService.off(GameSessionEvents.CombatResult);
        this.socketService.off(GameSessionEvents.PlayerAbandoned);
        this.socketService.off(GameSessionEvents.GameEnded);
        this.socketService.off(GameSessionEvents.ToggleDebugMode);
        this.socketService.off(GameSessionEvents.AvatarTakenUpdated);

        this.resetGameplayState();
        this.currentSession.set(null);
        this.takenAvatars.set([]);
        this.hasAbandoned.set(false);

        this.socketService.disconnect();
    }

    resetGameplayState(): void {
        this.currentPlayerTurn.set(null);
        this.turnTimeRemaining.set(0);
        this.reachableTiles.set([]);
        this.gameEnded.set(false);
        this.turnStarting.set(false);
        this.isDebugModeActivated.set(false);
        this.mapCopy.set(null);
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
                this.resetGameplayState();
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
            this.resetGameplayState();
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
            this.resetGameplayState();
            this.takenAvatars.set([]);
            this.hasAbandoned.set(false);
            this.router.navigate(['/']).then(() => {
                this.dialog.open(AppDialogComponent, {
                    data: { title: 'Salle annulée', message: data.message, type: 'info' },
                    disableClose: true,
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
            this.resetGameplayState();

            this.currentSession.set(gameSession);
            this.mapCopy.set(mapData);
            this.router.navigate(['/game-view'], { queryParams: { roomId } });
        });

        setupGameplayEventListeners(this, this.socketService, this.router, this.dialog);

        this.socketService.on<number[]>(GameSessionEvents.AvatarTakenUpdated, (avatarIds) => {
            this.takenAvatars.set(avatarIds);
        });

        this.socketService.on<{ isDebugModeActivated: boolean }>(GameSessionEvents.ToggleDebugMode, (data) => {
            this.isDebugModeActivated.set(data.isDebugModeActivated);
        });
    }

    requestGameSessionList(): void {
        this.socketService.emit(GameSessionEvents.RequestGameSessionList);
    }

    createGameSession(gameId: string, hostPlayer: Character): void {
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

    toggleDebugMode(): void {
        if (!this.isCurrentUserHost()) {
            return;
        }

        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.ToggleDebugMode, { currentRoomId });
        }
    }

    kickPlayer(targetId: string): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.KickPlayer, { roomId: currentRoomId, targetId });
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
        this.resetGameplayState();
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

    requestMove(direction: string): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.RequestMove, { roomId: currentRoomId, direction });
        }
    }

    requestAssignPosition(position: Position): void {
        if (!this.isMyTurn() || !this.isDebugModeActivated()) {
            return;
        }

        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.RequestAssignPosition, { roomId: currentRoomId, position });
        }
    }

    requestCombat(defenderId: string): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.RequestCombat, { roomId: currentRoomId, defenderId });
        }
    }

    endTurn(): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.EndTurnRequest, { roomId: currentRoomId });
        }
    }

    abandonGame(): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.hasAbandoned.set(true);
            this.socketService.emit(GameSessionEvents.PlayerAbandoned, { roomId: currentRoomId });
        }

        this.currentSession.set(null);
        this.resetGameplayState();
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

    isMyTurn(): boolean {
        const currentPlayerId = this.currentPlayerTurn();
        if (!currentPlayerId) return false;
        const mySocketId = this.getSocketId();
        const myPlayer = this.currentSession()?.players.find(p => p.socketId === mySocketId);
        return myPlayer?.character.id === currentPlayerId;
    }

    getCurrentPlayerCharacter(): Character | null {
        const mySocketId = this.getSocketId();
        return this.currentSession()?.players.find(p => p.socketId === mySocketId)?.character ?? null;
    }

    getAutoAttackTarget(): Character | null {
        const currentPlayer = this.getCurrentPlayerCharacter();
        if (!currentPlayer?.position) {
            return null;
        }

        const session = this.currentSession();
        if (!session) {
            return null;
        }

        return session.players
            .map(player => player.character)
            .find(character =>
                character.id !== currentPlayer.id &&
                character.position !== undefined &&
                this.areAdjacent(currentPlayer.position as Position, character.position),
            ) ?? null;
    }

    canAttackTarget(target: Character | null): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();

        return (
            this.isMyTurn() &&
            currentPlayer?.position !== undefined &&
            target?.position !== undefined &&
            target.id !== currentPlayer.id &&
            currentPlayer.remainingActions !== undefined &&
            currentPlayer.remainingActions > 0 &&
            this.areAdjacent(currentPlayer.position, target.position)
        );
    }

    canCurrentPlayerAttack(): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        return this.isMyTurn() && currentPlayer?.position != null && currentPlayer.remainingActions != null &&
            currentPlayer.remainingActions > 0 && this.getAutoAttackTarget() !== null;
    }

    private areAdjacent(positionA: Position, positionB: Position): boolean {
        return Math.abs(positionA.x - positionB.x) + Math.abs(positionA.y - positionB.y) === 1;
    }
}
