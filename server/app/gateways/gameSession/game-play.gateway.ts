import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GameSessionGateway } from '@app/gateways/gameSession/game-session.gateway';
import { GameSessionService } from '@app/services/gameSession/gameSession.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { GameSession } from '@common/gameSession';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
    OnGatewayInit, SubscribeMessage,
    WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class GamePlayGateway implements OnGatewayInit {
    @WebSocketServer() private server: Server;

    private readonly turnStartDelay = 3000;
    private readonly gameEndCleanupDelay = 5000;

    constructor(
        private readonly logger: Logger,
        @Inject(forwardRef(() => GameSessionService))
        private gameSessionService: GameSessionService,
        @Inject(forwardRef(() => ChatGateway))
        private chatGateway: ChatGateway,
        @Inject(forwardRef(() => GameSessionGateway))
        private gameSessionGateway: GameSessionGateway,
    ) {}

    afterInit() {
        this.logger.log('GamePlayGateway initialisé');
    }

    @SubscribeMessage(GameSessionEvents.StartGame)
    async handleStartGame(socket: Socket, payload: { roomId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);

        if (!gameSession) {
            socket.emit(GameSessionEvents.GameSessionJoinError, 'Session introuvable');
            return;
        }
        if (!gameSession.isHost(socket.id)) {
            socket.emit(GameSessionEvents.GameSessionJoinError, "Seul l'organisateur peut démarrer la partie");
            return;
        }
        if (gameSession.players.length < 2) {
            socket.emit(GameSessionEvents.GameSessionJoinError, 'Il faut au moins 2 joueurs pour démarrer');
            return;
        }

        const fullMapData = await this.gameSessionService.getFullMapData(gameSession.mapId);
        this.gameSessionService.initializeGameSession(gameSession, fullMapData);

        this.server.to(payload.roomId).emit(GameSessionEvents.GameStarted, {
            roomId: payload.roomId,
            mapData: fullMapData,
            gameSession,
        });
        this.logger.log(`Partie démarrée dans la salle ${payload.roomId}`);

        this.startGameTurn(gameSession);
    }

    @SubscribeMessage(GameSessionEvents.EndTurnRequest)
    handleEndTurnRequest(socket: Socket, payload: { roomId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.id !== socket.id) {
            return;
        }

        this.gameSessionService.endCurrentTurn(gameSession);
        this.handleTurnEnd(gameSession);
    }

    @SubscribeMessage(GameSessionEvents.RequestMove)
    handleRequestMove(socket: Socket, payload: { roomId: string; direction: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.id !== socket.id) {
            return;
        }

        const direction = payload.direction as 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight';
        const success = this.gameSessionService.executeMove(gameSession, direction);

        if (success) {
            this.server.to(payload.roomId).emit(GameSessionEvents.MoveExecuted, {
                playerId: socket.id,
                position: currentPlayer.position,
                remainingMovement: currentPlayer.remainingMovement,
            });

            this.emitReachableTiles(gameSession);

            if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
                this.gameSessionService.endCurrentTurn(gameSession);
                this.handleTurnEnd(gameSession);
            }
        }
    }

    @SubscribeMessage(GameSessionEvents.RequestCombat)
    handleRequestCombat(socket: Socket, payload: { roomId: string; defenderId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.id !== socket.id) {
            return;
        }

        try {
            const result = this.gameSessionService.executeCombat(gameSession, payload.defenderId);

            this.server.to(payload.roomId).emit(GameSessionEvents.CombatResult, {
                winner: result.winner,
                loser: result.loser,
                attackerVictories: result.attackerVictories,
                defenderNewPosition: gameSession.players.find(p => p.character.id === payload.defenderId)?.character.position,
            });

            const winner = this.gameSessionService.checkGameWinner(gameSession);
            if (winner) {
                this.handleGameEnd(gameSession, winner);
                return;
            }

            if (result.loser === currentPlayer.id) {
                this.gameSessionService.endCurrentTurn(gameSession);
                this.handleTurnEnd(gameSession);
            }
        } catch (error) {
            this.logger.error(`Combat error: ${error.message}`);
        }
    }

    @SubscribeMessage(GameSessionEvents.PlayerAbandoned)
    handlePlayerAbandoned(socket: Socket, payload: { roomId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        if (gameSession.status !== 'playing') {
            return;
        }

        const wasCurrentPlayer = gameSession.getCurrentPlayer()?.id === socket.id;

        this.gameSessionService.removePlayer(payload.roomId, socket.id);

        this.server.to(payload.roomId).emit(GameSessionEvents.PlayerAbandoned, {
            playerId: socket.id,
        });

        const winner = this.gameSessionService.checkGameWinner(gameSession);
        if (winner) {
            this.handleGameEnd(gameSession, winner);
            return;
        }

        if (gameSession.playerOrder.length === 1) {
            this.handleGameEnd(gameSession, null);
            return;
        }

        if (gameSession.playerOrder.length === 0) {
            this.handleGameEnd(gameSession, null);
            return;
        }

        if (wasCurrentPlayer) {
            this.handleTurnEnd(gameSession);
        }
    }

    private startGameTurn(gameSession: GameSession): void {
        const currentPlayer = gameSession.getCurrentPlayer();

        this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnStarting, {
            playerId: currentPlayer?.id,
            playerName: currentPlayer?.name,
            delay: this.turnStartDelay,
        });

        setTimeout(() => {
            this.gameSessionService.startCurrentTurn(
                gameSession,
                () => {
                    this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnStarted, {
                        playerId: currentPlayer?.id,
                        playerName: currentPlayer?.name,
                        turnTime: gameSession.getCurrentTurnTime(),
                    });
                    this.emitReachableTiles(gameSession);

                    if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
                        this.gameSessionService.endCurrentTurn(gameSession);
                        this.handleTurnEnd(gameSession);
                    }
                },
                (timeRemaining: number) => {
                    this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnTimeUpdate, {
                        timeRemaining,
                    });
                },
                () => {
                    this.handleTurnEnd(gameSession);
                },
            );
        }, this.turnStartDelay);
    }

    private handleTurnEnd(gameSession: GameSession): void {
        const currentPlayer = gameSession.getCurrentPlayer();
        this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnEnded, {
            playerId: currentPlayer?.id,
        });

        const winner = this.gameSessionService.checkGameWinner(gameSession);
        if (winner) {
            this.handleGameEnd(gameSession, winner);
            return;
        }

        if (gameSession.playerOrder.length === 1) {
            this.handleGameEnd(gameSession, null);
            return;
        }

        if (gameSession.playerOrder.length === 0) {
            this.handleGameEnd(gameSession, null);
            return;
        }

        this.startGameTurn(gameSession);
    }

    private handleGameEnd(gameSession: GameSession, winner: Character | null): void {
        this.gameSessionService.cleanupTurnTimers(gameSession.roomId);

        this.server.to(gameSession.roomId).emit(GameSessionEvents.GameEnded, {
            winner: winner ? { id: winner.id, name: winner.name, avatarId: winner.avatarId } : null,
            reason: winner ? 'victory' : 'noPlayers',
        });

        setTimeout(() => {
            this.gameSessionGateway.cleanupGameSession(gameSession.roomId);
        }, this.gameEndCleanupDelay);
    }

    private emitReachableTiles(gameSession: GameSession): void {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) {
            return;
        }

        const reachableTiles = this.gameSessionService.getReachableTiles(gameSession);
        this.server.to(gameSession.roomId).emit(GameSessionEvents.ReachableTiles, {
            playerId: currentPlayer.id,
            tiles: reachableTiles,
        });
    }
}
