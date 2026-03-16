import { Game } from '@app/model/game';
import { GameService } from '@app/services/game/game.service';
import { GameSessionService } from '@app/services/gameSession/gameSession.service';
import { Character } from '@common/character';
import { GameEvents, GameSessionEvents } from '@common/game.events';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;
    private playerSockets: Map<string, string> = new Map();
    private socketRooms: Map<string, string> = new Map();
    private roomTimers: Map<string, NodeJS.Timeout> = new Map();
    private static readonly gameSessionCleanupDelayMs = 5000;

    constructor(
        private readonly logger: Logger,
        @Inject(forwardRef(() => GameService))
        private gameService: GameService,
        private gameSessionService: GameSessionService,
    ) {}

    afterInit() {
        this.logger.log('GameGateway initialisé');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Client connecté au GameGateway: ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Client déconnecté du GameGateway: ${socket.id}`);

        const roomId = this.socketRooms.get(socket.id);
        if (roomId) {
            this.handlePlayerAbandonInternal(roomId, socket);
        }

        this.socketRooms.delete(socket.id);
    }

    @SubscribeMessage(GameEvents.RequestGameList)
    async handleRequestGameList(socket: Socket) {
        const games = await this.gameService.findAdminMenuGames();
        socket.emit(GameEvents.GameList, games);
    }

    @SubscribeMessage(GameEvents.RequestVisibleGameList)
    async handleRequestVisibleGameList(socket: Socket) {
        const games = await this.gameService.findVisible();
        socket.emit(GameEvents.GameList, games);
    }

    @SubscribeMessage(GameSessionEvents.StartGame)
    async handleStartGame(socket: Socket, data: { roomId: string }) {
        const { roomId } = data;
        const gameSession = this.gameSessionService.getGameSession(roomId);

        if (!gameSession) {
            socket.emit('error', { message: 'Game session not found' });
            return;
        }

        try {
            const game = await this.gameService.findOne(gameSession.mapId);
            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            this.gameSessionService.initializeGameSession(gameSession, game);

            this.server.to(roomId).emit(GameSessionEvents.GameStarted, {
                players: gameSession.getActivePlayers(),
                playerOrder: gameSession.playerOrder,
                startingPoints: Array.from(gameSession.startingPoints.entries()),
                mapCopy: gameSession.getMapCopy(),
            });

            this.startNextTurn(roomId);
        } catch (error) {
            this.logger.error(`Error starting game: ${error.message}`);
            socket.emit('error', { message: 'Failed to start game' });
        }
    }

    @SubscribeMessage(GameSessionEvents.RequestMove)
    handleRequestMove(
        socket: Socket,
        data: { roomId: string; direction: string; playerId: string },
    ) {
        const { roomId, direction, playerId } = data;
        const gameSession = this.gameSessionService.getGameSession(roomId);

        if (!gameSession || gameSession.getCurrentPlayer()?.id !== playerId) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        try {
            const success = this.gameSessionService.executeMove(
                gameSession,
                direction as 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight',
            );

            if (success) {
                const currentPlayer = gameSession.getCurrentPlayer();
                const reachableTiles = this.gameSessionService.getReachableTiles(gameSession);

                this.server.to(roomId).emit(GameSessionEvents.MoveExecuted, {
                    playerId: currentPlayer?.id,
                    newPosition: currentPlayer?.position,
                });

                socket.emit(GameSessionEvents.ReachableTiles, { tiles: reachableTiles });
            } else {
                socket.emit('error', { message: 'Invalid move' });
            }
        } catch (error) {
            this.logger.error(`Move error: ${error.message}`);
            socket.emit('error', { message: 'Move failed' });
        }
    }

    @SubscribeMessage(GameSessionEvents.RequestCombat)
    handleRequestCombat(
        socket: Socket,
        data: { roomId: string; defenderId: string; playerId: string },
    ) {
        const { roomId, defenderId, playerId } = data;
        const gameSession = this.gameSessionService.getGameSession(roomId);

        if (!gameSession || gameSession.getCurrentPlayer()?.id !== playerId) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        try {
            const currentPlayer = gameSession.getCurrentPlayer();
            const defender = gameSession.players.find(p => p.character.id === defenderId)?.character;

            if (!currentPlayer || !defender) {
                socket.emit('error', { message: 'Invalid combat participants' });
                return;
            }

            const result = this.gameSessionService.executeCombat(gameSession, defenderId);

            this.server.to(roomId).emit(GameSessionEvents.CombatResult, result);

            const winner = this.gameSessionService.checkGameWinner(gameSession);
            if (winner && gameSession.getActivePlayers().includes(winner)) {
                this.endGame(roomId, winner);
                return;
            }


        } catch (error) {
            this.logger.error(`Combat error: ${error.message}`);
            socket.emit('error', { message: 'Combat failed' });
        }
    }

    @SubscribeMessage(GameSessionEvents.EndTurnRequest)
    handleEndTurn(socket: Socket, data: { roomId: string; playerId: string }) {
        const { roomId, playerId } = data;
        const gameSession = this.gameSessionService.getGameSession(roomId);

        if (!gameSession || gameSession.getCurrentPlayer()?.id !== playerId) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        this.gameSessionService.endCurrentTurn(gameSession);
        this.startNextTurn(roomId);
    }

    @SubscribeMessage(GameSessionEvents.PlayerAbandoned)
    handlePlayerAbandonedEvent(socket: Socket, data: { roomId: string }) {
        const { roomId } = data;
        this.handlePlayerAbandonInternal(roomId, socket);
    }

    private handlePlayerAbandonInternal(roomId: string, socket: Socket) {
        const gameSession = this.gameSessionService.getGameSession(roomId);
        if (!gameSession) return;

        const abandonedPlayer = Array.from(this.playerSockets.entries()).find(
            ([, socketId]) => socketId === socket.id,
        );

        if (abandonedPlayer) {
            const [playerId] = abandonedPlayer;
            this.gameSessionService.removePlayer(roomId, playerId);
            this.playerSockets.delete(playerId);

            this.server.to(roomId).emit(GameSessionEvents.PlayerAbandoned, { playerId });

            const activePlayers = gameSession.getActivePlayers();
            if (activePlayers.length === 1) {
                this.endGame(roomId, activePlayers[0], true);
            } else if (activePlayers.length === 0) {
                this.endGame(roomId, null, true);
            } else {
                this.startNextTurn(roomId);
            }
        }
    }

    private async startNextTurn(roomId: string) {
        const gameSession = this.gameSessionService.getGameSession(roomId);
        if (!gameSession) return;

        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) {
            this.endGame(roomId, null);
            return;
        }

        this.server.to(roomId).emit(GameSessionEvents.TurnStarting, {
            playerId: currentPlayer.id,
            delaySeconds: 3,
        });

        try {
            await this.gameSessionService.startCurrentTurn(
                gameSession,
                () => {
                    this.server.to(roomId).emit(GameSessionEvents.TurnStarted, {
                        playerId: currentPlayer.id,
                        timeRemaining: 30,
                    });

                    const reachableTiles = this.gameSessionService.getReachableTiles(gameSession);
                    const socketId = this.playerSockets.get(currentPlayer.id);
                    if (socketId) {
                        this.server.to(socketId).emit(GameSessionEvents.ReachableTiles, {
                            tiles: reachableTiles,
                        });
                    }
                },
                (timeRemaining: number) => {
                    this.server.to(roomId).emit(GameSessionEvents.TurnTimeUpdate, {
                        timeRemaining,
                    });
                },
                () => {
                    this.startNextTurn(roomId);
                },
            );
        } catch (error) {
            this.logger.error(`Error starting turn: ${error.message}`);
        }
    }

    private endGame(roomId: string, winner?: Character | null, noWinner: boolean = false) {
        const gameSession = this.gameSessionService.getGameSession(roomId);
        if (!gameSession) return;

        gameSession.setStatus('ended');

        const gameEndData: unknown = {
            winner: winner ? {
                id: winner.id,
                name: winner.name,
                victories: winner.victories,
            } : null,
            noWinner: noWinner || false,
        };

        this.server.to(roomId).emit(GameSessionEvents.GameEnded, gameEndData);

        if (this.roomTimers.has(roomId)) {
            clearTimeout(this.roomTimers.get(roomId));
            this.roomTimers.delete(roomId);
        }

        const cleanupTimer = setTimeout(() => {
            this.gameSessionService.deleteGameSession(roomId);
            this.socketRooms.forEach((room, socketId) => {
                if (room === roomId) {
                    this.socketRooms.delete(socketId);
                }
            });
            this.roomTimers.delete(roomId);
        }, GameGateway.gameSessionCleanupDelayMs);

        this.roomTimers.set(roomId, cleanupTimer);
    }

    notifyGameCreated(game: Game): void {
        this.server.emit(GameEvents.GameCreated, game);
    }

    notifyGameUpdated(game: Game): void {
        this.server.emit(GameEvents.GameUpdated, game);
    }

    notifyGameDeleted(gameId: string): void {
        this.server.emit(GameEvents.GameDeleted, gameId);
    }
}
