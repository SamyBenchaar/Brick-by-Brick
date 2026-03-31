import { GameSession } from '@app/domain/game-session';
import { GameSessionGateway } from '@app/gateways/game-session/game-session/game-session.gateway';
import { CombatService } from '@app/services/game-session/combat.service';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { MovementService } from '@app/services/game-session/movement.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { Character } from '@common/character';
import { CombatPosture, CombatResultPayload, CombatState } from '@common/combat';
import { GameSessionEvents } from '@common/game.events';
import { Position } from '@common/position';
import { SessionStatus } from '@common/session.status';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
    OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class GamePlayGateway implements OnGatewayInit {
    @WebSocketServer() private server: Server;

    private readonly gameEndCleanupDelay = 5000;
    private readonly toMllisecondsFactor = 1000;
    private readonly interTurnTime = 3;
    private readonly combatTimers = new Map<string, NodeJS.Timeout>();

    constructor(
        private readonly logger: Logger,
        @Inject(forwardRef(() => GameSessionService))
        private gameSessionService: GameSessionService,
        @Inject(forwardRef(() => GameSessionGateway))
        private gameSessionGateway: GameSessionGateway,
        private movementService: MovementService,
        @Inject(forwardRef(() => TurnManagementService))
        private turnManagementService: TurnManagementService,
        private combatService: CombatService,
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
        gameSession.status = SessionStatus.Playing;
        this.gameSessionGateway.notifyGameSessionListUpdated();

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
        const newIsDebugModeActivated = !gameSession.isDebugModeActivated;
        gameSession.isDebugModeActivated = newIsDebugModeActivated;

        this.server.to(payload.currentRoomId).emit(GameSessionEvents.ToggleDebugMode, {
            isDebugModeActivated: newIsDebugModeActivated,
        });
    }

    @SubscribeMessage(GameSessionEvents.EndTurnRequest)
    handleEndTurnRequest(socket: Socket, payload: { roomId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession || gameSession.isTurnStarting || gameSession.combat) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find(p => p.socketId === socket.id);
        if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id && !gameSession.isDebugModeActivated) {
            return;
        }

        this.gameSessionService.endCurrentTurn(gameSession);
        this.handleTurnEnd(gameSession);
    }

    @SubscribeMessage(GameSessionEvents.RequestMove)
    handleRequestMove(socket: Socket, payload: { roomId: string; direction: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession || gameSession.isTurnStarting || gameSession.combat) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find(p => p.socketId === socket.id);

        if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id) {
            return;
        }

        const direction = payload.direction as 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight';
        const success = this.gameSessionService.executeMove(gameSession, direction);

        if (success) {
            this.server.to(payload.roomId).emit(GameSessionEvents.MoveExecuted, {
                playerId: currentPlayer.id,
                position: currentPlayer.position,
                remainingMovement: currentPlayer.remainingMovement,
                remainingActions: currentPlayer.remainingActions,
            });

            this.emitReachableTiles(gameSession);

            if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
                this.gameSessionService.endCurrentTurn(gameSession);
                this.handleTurnEnd(gameSession);
            }
        }
    }

    @SubscribeMessage(GameSessionEvents.RequestAssignPosition)
    handleRequestAssignPosition(socket: Socket, payload: { roomId: string; position: Position }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession || gameSession.isTurnStarting || gameSession.combat) return;

        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) return;
        this.movementService.assignPosition(currentPlayer, gameSession, payload.position);
        this.server.to(payload.roomId).emit(GameSessionEvents.MoveExecuted, {
            playerId: currentPlayer.id,
            position: currentPlayer.position,
            remainingMovement: currentPlayer.remainingMovement,
            remainingActions: currentPlayer.remainingActions,
        });
        this.emitReachableTiles(gameSession);
    }

    @SubscribeMessage(GameSessionEvents.RequestCombat)
    handleRequestCombat(socket: Socket, payload: { roomId: string; defenderId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession || gameSession.isTurnStarting || gameSession.combat) return;

        const attacker = gameSession.getCurrentPlayer();
        const defender = gameSession.players.find((player) => player.character.id === payload.defenderId)?.character;
        const requester = gameSession.players.find((player) => player.socketId === socket.id);

        if (!attacker || !defender || !requester || attacker.id !== requester.character.id || !this.combatService.canFight(attacker, defender)) {
            return;
        }

        this.gameSessionService.cleanupTurnTimers(gameSession.roomId);
        gameSession.combat = this.combatService.startCombat(gameSession, attacker, defender);
        this.emitCombatState(gameSession, GameSessionEvents.CombatStarted);
        this.startCombatTimer(gameSession);
    }

    @SubscribeMessage(GameSessionEvents.CombatChoosePosture)
    handleCombatChoice(socket: Socket, payload: { roomId: string; posture: CombatPosture }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        const combat = gameSession?.combat;
        if (!gameSession || !combat) return;

        const playerId = gameSession.players.find((player) => player.socketId === socket.id)?.character.id;
        if (!playerId || ![combat.attacker.id, combat.defender.id].includes(playerId)) return;

        this.combatService.submitChoice(combat, playerId, payload.posture);
        this.emitCombatState(gameSession, GameSessionEvents.CombatUpdated);

        if (this.combatService.bothPlayersReady(combat)) {
            this.resolveCombatRound(gameSession);
        }
    }

    @SubscribeMessage(GameSessionEvents.PlayerAbandoned)
    handlePlayerAbandoned(socket: Socket, payload: { roomId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        if (gameSession.status !== SessionStatus.Playing) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const abandoningPlayer = gameSession.players.find(p => p.socketId === socket.id);
        const wasCurrentPlayer = currentPlayer && abandoningPlayer && currentPlayer.id === abandoningPlayer.character.id;

        let combatResult: CombatResultPayload | null = null;

        if (gameSession.combat && abandoningPlayer) {
            combatResult = this.combatService.resolveAbandon(gameSession, gameSession.combat, abandoningPlayer.character.id);
            this.clearCombatTimer(gameSession.roomId);
            gameSession.combat = null;
            if (combatResult) this.emitCombatResult(gameSession, combatResult);
        }

        this.gameSessionService.removePlayer(payload.roomId, socket.id);

        this.server.to(payload.roomId).emit(GameSessionEvents.PlayerAbandoned, {
            playerId: abandoningPlayer?.character.id,
            mapCopyTiles: gameSession.mapCopy?.tiles,
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

        if (combatResult?.activePlayerWon && !wasCurrentPlayer) return this.resumeCurrentTurn(gameSession);
    }

    private startGameTurn(gameSession: GameSession): void {
        const currentPlayer = gameSession.getCurrentPlayer();

        gameSession.isTurnStarting = true;
        gameSession.setCurrentInterTurnTime(this.interTurnTime);

        this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnStarting, {
            playerId: currentPlayer?.id,
            playerName: currentPlayer?.name,
            delay: gameSession.getCurrentInterTurnTime() * this.toMllisecondsFactor,
        });

        this.turnManagementService.startInterTurnCountdown(
            gameSession,
            gameSession.getCurrentInterTurnTime(),
            (timeRemaining) => {
                this.server.to(gameSession.roomId).emit(GameSessionEvents.InterTurnTimeUpdate, {
                    timeRemaining,
                });
            },
            () => {
                gameSession.isTurnStarting = false;

                this.gameSessionService.startCurrentTurn(
                    gameSession,
                    () => {
                        this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnStarted, {
                            playerId: currentPlayer?.id,
                            playerName: currentPlayer?.name,
                            turnTime: gameSession.getCurrentTurnTime(),
                            remainingMovement: currentPlayer?.remainingMovement,
                            remainingActions: currentPlayer?.remainingActions,
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
            },
        );
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
        this.clearCombatTimer(gameSession.roomId);
        gameSession.combat = null;

        this.server.to(gameSession.roomId).emit(GameSessionEvents.GameEnded, {
            winner: winner ? { id: winner.id, name: winner.name, avatarId: winner.avatarId } : null,
            reason: winner ? 'victory' : 'noPlayers',
        });

        setTimeout(() => {
            this.gameSessionGateway.cleanUpRoom(gameSession.roomId);
        }, this.gameEndCleanupDelay);
    }

    private startCombatTimer(gameSession: GameSession): void {
        this.clearCombatTimer(gameSession.roomId);

        const timer = setInterval(() => {
            const combat = gameSession.combat;
            if (!combat) return this.clearCombatTimer(gameSession.roomId);

            const timeRemaining = this.combatService.tickCombat(combat);
            this.emitCombatState(gameSession, GameSessionEvents.CombatUpdated);

            if (timeRemaining <= 0) this.resolveCombatRound(gameSession);
        }, 1000);

        this.combatTimers.set(gameSession.roomId, timer);
    }

    private resolveCombatRound(gameSession: GameSession): void {
        this.clearCombatTimer(gameSession.roomId);

        const combat = gameSession.combat;
        if (!combat) return;

        const { result } = this.combatService.resolveRound(gameSession, combat, gameSession.isDebugModeActivated);

        if (!result) {
            this.emitCombatState(gameSession, GameSessionEvents.CombatUpdated);
            return this.startCombatTimer(gameSession);
        }

        gameSession.combat = null;
        this.emitCombatResult(gameSession, result);

        const winner = this.gameSessionService.checkGameWinner(gameSession);
        if (winner) return this.handleGameEnd(gameSession, winner);

        if (result.activePlayerWon) return this.resumeCurrentTurn(gameSession);

        this.gameSessionService.endCurrentTurn(gameSession);
        this.handleTurnEnd(gameSession);
    }

    private resumeCurrentTurn(gameSession: GameSession): void {
        this.turnManagementService.startTurnTimer(
            gameSession,
            () => {
                this.gameSessionService.endCurrentTurn(gameSession);
                this.handleTurnEnd(gameSession);
            },
            (timeRemaining) => this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnTimeUpdate, { timeRemaining }),
        );

        this.emitReachableTiles(gameSession);
    }

    private emitCombatState(gameSession: GameSession, event: GameSessionEvents.CombatStarted | GameSessionEvents.CombatUpdated): void {
        const combat = gameSession.combat;
        if (!combat) return;

        this.participantSockets(gameSession, combat).forEach((socketId) => {
            this.server.to(socketId).emit(event, combat);
        });
    }

    private emitCombatResult(gameSession: GameSession, result: CombatResultPayload): void {
        this.server.to(gameSession.roomId).emit(GameSessionEvents.CombatResult, result);
    }

    private participantSockets(gameSession: GameSession, combat: CombatState): string[] {
        return gameSession.players
            .filter((player) => [combat.attacker.id, combat.defender.id].includes(player.character.id))
            .map((player) => player.socketId);
    }

    private clearCombatTimer(roomId: string): void {
        const timer = this.combatTimers.get(roomId);
        if (timer) clearInterval(timer);
        this.combatTimers.delete(roomId);
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
