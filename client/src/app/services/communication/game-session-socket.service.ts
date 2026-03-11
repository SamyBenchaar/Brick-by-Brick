import { Injectable, signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { Game } from '@app/interfaces/game';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { GameSession, Position } from '@common/gameSession';
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

    private listenersInitialized = false;
    private readonly endGameDelay = 3000;

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

        this.socketService.on<{ playerId: string; playerName: string; delay: number }>(
            GameSessionEvents.TurnStarting,
            (data) => {
                this.turnStarting.set(true);
                this.currentPlayerTurn.set(data.playerId);
            },
        );

        this.socketService.on<{ playerId: string; playerName: string; turnTime: number }>(
            GameSessionEvents.TurnStarted,
            (data) => {
                this.turnStarting.set(false);
                this.currentPlayerTurn.set(data.playerId);
                this.turnTimeRemaining.set(data.turnTime);
            },
        );

        this.socketService.on<{ timeRemaining: number }>(GameSessionEvents.TurnTimeUpdate, (data) => {
            this.turnTimeRemaining.set(data.timeRemaining);
        });

        this.socketService.on<{ playerId: string }>(GameSessionEvents.TurnEnded, () => {
            this.currentPlayerTurn.set(null);
            this.reachableTiles.set([]);
        });

        this.socketService.on<{ playerId: string; position: Position; remainingMovement: number }>(
            GameSessionEvents.MoveExecuted,
            (data) => {
                const session = this.currentSession();
                if (session) {
                    const player = session.players.find(p => p.character.id === data.playerId);
                    if (player) {
                        player.character.position = data.position;
                        player.character.remainingMovement = data.remainingMovement;
                        this.currentSession.update(() => session);
                    }
                }
            },
        );

        this.socketService.on<{ playerId: string; tiles: Position[] }>(GameSessionEvents.ReachableTiles, (data) => {
            this.reachableTiles.set(data.tiles);
        });

        this.socketService.on<{
            winner: string;
            loser: string;
            attackerVictories: number;
            defenderNewPosition: Position;
        }>(GameSessionEvents.CombatResult, (data) => {
            const session = this.currentSession();
            if (session) {
                const attacker = session.players.find(p => p.character.id === data.winner);
                const defender = session.players.find(p => p.character.id === data.loser);

                if (attacker) {
                    attacker.character.victories = data.attackerVictories;
                }
                if (defender) {
                    defender.character.position = data.defenderNewPosition;
                }

                this.currentSession.update(() => session);
            }
        });

        this.socketService.on<{ playerId: string }>(GameSessionEvents.PlayerAbandoned, (data) => {
            const session = this.currentSession();
            if (session) {
                session.players = session.players.filter(p => p.character.id !== data.playerId);
                session.playerOrder = session.playerOrder.filter(id => id !== data.playerId);
                this.currentSession.update(() => session);
            }
        });

        this.socketService.on<{ winner: { id: string; name: string; avatarId: number } | null; reason: string }>(
            GameSessionEvents.GameEnded,
            (data) => {
                if (this.hasAbandoned()) {
                    this.hasAbandoned.set(false);
                    this.currentSession.set(null);
                    return;
                }

                this.gameEnded.set(true);
                let message = '';
                let title = 'Partie terminée';

                if (data.reason === 'victory' && data.winner) {
                    const mySocketId = this.socketService.getSocketId();
                    if (data.winner.id === mySocketId) {
                        title = 'Victoire!';
                        message = `Félicitations! Vous avez gagné la partie avec 3 victoires!`;
                    } else {
                        title = 'Partie terminée';
                        message = `${data.winner.name} a gagné la partie avec 3 victoires!`;
                    }
                } else if (data.reason === 'noPlayers') {
                    message = 'La partie est terminée car tous les autres joueurs ont abandonné.';
                } else {
                    message = 'La partie est terminée.';
                }

                setTimeout(() => {
                    this.router.navigate(['/']).then(() => {
                        this.dialog.open(AppDialogComponent, {
                            data: { title, message, type: data.reason === 'victory' ? 'info' : 'info' },
                            disableClose: true,
                        });
                        this.gameEnded.set(false);
                        this.currentSession.set(null);
                    });
                }, this.endGameDelay);
            },
        );
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

    startGame(): void {
        const currentRoomId = this.currentSession()?.roomId;
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.StartGame, { roomId: currentRoomId });
        }
    }

    requestMove(direction: string): void {
        const currentRoomId = this.currentSession()?.roomId;
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.RequestMove, { roomId: currentRoomId, direction });
        }
    }

    requestCombat(defenderId: string): void {
        const currentRoomId = this.currentSession()?.roomId;
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.RequestCombat, { roomId: currentRoomId, defenderId });
        }
    }

    endTurn(): void {
        const currentRoomId = this.currentSession()?.roomId;
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.EndTurnRequest, { roomId: currentRoomId });
        }
    }

    abandonGame(): void {
        const currentRoomId = this.currentSession()?.roomId;
        if (currentRoomId) {
            this.hasAbandoned.set(true);
            this.socketService.emit(GameSessionEvents.PlayerAbandoned, { roomId: currentRoomId });
            this.currentSession.set(null);
            this.router.navigate(['/']);
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

    isMyTurn(): boolean {
        return this.currentPlayerTurn() === this.getSocketId();
    }
}
