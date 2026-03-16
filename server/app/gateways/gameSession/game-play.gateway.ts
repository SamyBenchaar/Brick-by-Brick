import { GameSession } from '@app/domain/game-session';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GameSessionGateway } from '@app/gateways/gameSession/game-session.gateway';
import { GameSessionService } from '@app/services/gameSession/gameSession.service';
import { MovementService } from '@app/services/gameSession/movement.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { TileType } from '@common/map';
import { Position } from '@common/position';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
    OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer,
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
        private movementService: MovementService,
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

    @SubscribeMessage(GameSessionEvents.ToggleDebugMode)
    handleToggleDebugMode(socket: Socket, payload: { currentRoomId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.currentRoomId);
        if (!gameSession) {
            return;
        }

        if (!gameSession.isHost(socket.id)) {
            return;
        }

        const newIsDebugModeActivated = !gameSession.isDebugModeActivated;
        gameSession.isDebugModeActivated = newIsDebugModeActivated;

        this.server.to(payload.currentRoomId).emit(GameSessionEvents.ToggleDebugMode, {
            isDebugModeActivated: newIsDebugModeActivated,
        });
    }

    @SubscribeMessage(GameSessionEvents.EndTurnRequest)
    handleEndTurnRequest(socket: Socket, payload: { roomId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        if (gameSession.isTurnStarting) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find((p) => p.socketId === socket.id);
        const isHost = gameSession.isHost(socket.id);
        const isCurrentPlayer = !!currentPlayer && !!requestingPlayer && currentPlayer.id === requestingPlayer.character.id;
        const canForceEndTurn = gameSession.isDebugModeActivated && isHost;

        if (!currentPlayer || (!isCurrentPlayer && !canForceEndTurn)) {
            return;
        }

        const endedPlayerId = currentPlayer.id;
        this.gameSessionService.endCurrentTurn(gameSession);
        this.handleTurnEnd(gameSession, endedPlayerId);
    }

    @SubscribeMessage(GameSessionEvents.RequestMove)
    handleRequestMove(socket: Socket, payload: { roomId: string; direction: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        if (gameSession.isTurnStarting) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find((p) => p.socketId === socket.id);

        if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id) {
            return;
        }

        const direction = payload.direction as 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight';
        const success = this.gameSessionService.executeMove(gameSession, direction);

        if (!success) {
            return;
        }

        this.server.to(payload.roomId).emit(GameSessionEvents.MoveExecuted, {
            playerId: currentPlayer.id,
            position: currentPlayer.position,
            remainingMovement: currentPlayer.remainingMovement,
            remainingActions: currentPlayer.remainingActions,
        });

        this.emitReachableTiles(gameSession);

        if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
            const endedPlayerId = currentPlayer.id;
            this.gameSessionService.endCurrentTurn(gameSession);
            this.handleTurnEnd(gameSession, endedPlayerId);
        }
    }

    @SubscribeMessage(GameSessionEvents.RequestAssignPosition)
    handleRequestAssignPosition(socket: Socket, payload: { roomId: string; position: Position }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);

        if (!gameSession) {
            return;
        }

        if (!this.canAssignPosition(socket, gameSession, payload.position)) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) {
            return;
        }

        this.movementService.assignPosition(currentPlayer, gameSession, payload.position);

        this.server.to(payload.roomId).emit(GameSessionEvents.MoveExecuted, {
            playerId: currentPlayer.id,
            position: currentPlayer.position,
            remainingMovement: currentPlayer.remainingMovement,
            remainingActions: currentPlayer.remainingActions,
        });

        this.emitReachableTiles(gameSession);

        if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
            const endedPlayerId = currentPlayer.id;
            this.gameSessionService.endCurrentTurn(gameSession);
            this.handleTurnEnd(gameSession, endedPlayerId);
        }
    }

    private canAssignPosition(
        socket: Socket,
        gameSession: GameSession,
        position: Position,
    ): boolean {
        if (gameSession.isTurnStarting || !gameSession.isDebugModeActivated) {
            return false;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find((p) => p.socketId === socket.id);

        if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id) {
            return false;
        }

        return this.isValidTeleportDestination(gameSession, currentPlayer, position);
    }

    private isValidTeleportDestination(
        gameSession: GameSession,
        currentPlayer: Character,
        position: Position,
    ): boolean {
        const tile = gameSession.getMapCopy()?.tiles?.[position.y]?.[position.x];
        if (!tile) {
            return false;
        }

        const occupied = gameSession.players.some(
            (p) =>
                p.character.id !== currentPlayer.id &&
                p.character.position?.x === position.x &&
                p.character.position?.y === position.y,
        );

        return tile.type !== TileType.Wall && tile.type !== TileType.Door && !tile.object && !occupied;
    }

    @SubscribeMessage(GameSessionEvents.RequestCombat)
    handleRequestCombat(socket: Socket, payload: { roomId: string; defenderId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        if (gameSession.isTurnStarting) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find((p) => p.socketId === socket.id);

        if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id) {
            return;
        }

        try {
            const result = this.gameSessionService.executeCombat(gameSession, payload.defenderId);

            this.server.to(payload.roomId).emit(GameSessionEvents.CombatResult, {
                winner: result.winner,
                loser: result.loser,
                attackerVictories: result.attackerVictories,
                defenderNewPosition: gameSession.players.find((p) => p.character.id === payload.defenderId)?.character.position,
                remainingActions: currentPlayer.remainingActions,
            });

            const winner = this.gameSessionService.checkGameWinner(gameSession);
            if (winner) {
                this.handleGameEnd(gameSession, winner);
                return;
            }

            if (result.loser === currentPlayer.id) {
                const endedPlayerId = currentPlayer.id;
                this.gameSessionService.endCurrentTurn(gameSession);
                this.handleTurnEnd(gameSession, endedPlayerId);
                return;
            }

            if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
                const endedPlayerId = currentPlayer.id;
                this.gameSessionService.endCurrentTurn(gameSession);
                this.handleTurnEnd(gameSession, endedPlayerId);
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

        const currentPlayer = gameSession.getCurrentPlayer();
        const abandoningPlayer = gameSession.players.find((p) => p.socketId === socket.id);
        const wasCurrentPlayer = currentPlayer && abandoningPlayer && currentPlayer.id === abandoningPlayer.character.id;

        this.gameSessionService.removePlayer(payload.roomId, socket.id);

        this.server.to(payload.roomId).emit(GameSessionEvents.PlayerAbandoned, {
            playerId: abandoningPlayer?.character.id,
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

        if (wasCurrentPlayer && abandoningPlayer) {
            this.handleTurnEnd(gameSession, abandoningPlayer.character.id);
        }
    }

    private startGameTurn(gameSession: GameSession): void {
        gameSession.isTurnStarting = true;

        const startingPlayer = gameSession.getCurrentPlayer();

        this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnStarting, {
            playerId: startingPlayer?.id,
            playerName: startingPlayer?.name,
            delay: this.turnStartDelay,
        });

        setTimeout(() => {
            if (!this.gameSessionService.getGameSession(gameSession.roomId)) {
                this.logger.warn(`Session ${gameSession.roomId} no longer exists, aborting turn start`);
                return;
            }

            gameSession.isTurnStarting = false;

            this.gameSessionService.startCurrentTurn(
                gameSession,
                () => {
                    const currentPlayer = gameSession.getCurrentPlayer();
                    if (!currentPlayer) {
                        return;
                    }

                    this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnStarted, {
                        playerId: currentPlayer.id,
                        playerName: currentPlayer.name,
                        turnTime: gameSession.getCurrentTurnTime(),
                        remainingMovement: currentPlayer.remainingMovement,
                        remainingActions: currentPlayer.remainingActions,
                    });

                    this.emitReachableTiles(gameSession);

                    if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
                        const endedPlayerId = currentPlayer.id;
                        this.gameSessionService.endCurrentTurn(gameSession);
                        this.handleTurnEnd(gameSession, endedPlayerId);
                    }
                },
                (timeRemaining: number) => {
                    this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnTimeUpdate, {
                        timeRemaining,
                    });
                },
                (endedPlayerId: string) => {
                    this.handleTurnEnd(gameSession, endedPlayerId);
                },
            );
        }, this.turnStartDelay);
    }

    private handleTurnEnd(gameSession: GameSession, endedPlayerId: string): void {
        this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnEnded, {
            playerId: endedPlayerId,
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
            this.gameSessionGateway.cleanUpRoom(gameSession.roomId);
        }, this.gameEndCleanupDelay);
    }

    private emitReachableTiles(gameSession: GameSession): void {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) {
            return;
        }

        const playerData = gameSession.players.find(p => p.character.id === currentPlayer.id);
        if (!playerData) {
            return;
        }

        const reachableTiles = this.gameSessionService.getReachableTiles(gameSession);
        this.server.to(playerData.socketId).emit(GameSessionEvents.ReachableTiles, {
            playerId: currentPlayer.id,
            tiles: reachableTiles,
        });
    }
}
