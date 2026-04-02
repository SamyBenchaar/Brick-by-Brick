import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GamePlayHandlersProvider } from '@app/gateways/game-session/game-play/game-play-handlers.provider';
import { GameSessionGateway } from '@app/gateways/game-session/game-session/game-session.gateway';
import { GameDataForInit } from '@app/interfaces/game-map-interfaces';
import { CombatService } from '@app/services/game-session/combat.service';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { Character } from '@common/character';
import { CombatPosture, CombatResultPayload } from '@common/combat';
import { GameSessionEvents } from '@common/game.events';
import { Player } from '@common/player';
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
    private readonly combatTickInterval = 1000;
    private readonly combatTimers = new Map<string, NodeJS.Timeout>();

    constructor(
        private readonly logger: Logger,
        @Inject(forwardRef(() => GameSessionService))
        private gameSessionService: GameSessionService,
        @Inject(forwardRef(() => GameSessionGateway))
        private gameSessionGateway: GameSessionGateway,
        private combatService: CombatService,
        private handlersProvider: GamePlayHandlersProvider,
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

        if (gameSession.gameMode === 'ctf' && gameSession.players.length % 2 !== 0) {
            socket.emit(GameSessionEvents.GameSessionJoinError, 'Le mode CTF requiert un nombre pair de joueurs');
            return;
        }

        gameSession.status = SessionStatus.Playing;
        this.gameSessionGateway.notifyGameSessionListUpdated();

        const fullMapData = await this.gameSessionService.getFullMapData(gameSession.mapId);
        this.gameSessionService.initializeGameSession(gameSession, fullMapData);

        if (gameSession.gameMode === 'ctf') {
            gameSession.assignTeams();
            this.findAndSetFlagPosition(gameSession, fullMapData);
        }

        if (gameSession.gameMode === 'ctf') {
            this.server.to(payload.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }

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
        this.handlersProvider.movementHandler.handleRequestMove(socket, payload, this.createHandlerContext());
    }

    @SubscribeMessage(GameSessionEvents.RequestAssignPosition)
    handleRequestAssignPosition(socket: Socket, payload: { roomId: string; position: Position }) {
        this.handlersProvider.movementHandler.handleRequestAssignPosition(socket, payload, this.createHandlerContext());
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

    @SubscribeMessage(GameSessionEvents.RequestInteract)
    handleRequestInteract(socket: Socket, payload: { roomId: string; position: Position }) {
        this.handlersProvider.movementHandler.handleRequestInteract(socket, payload, this.createHandlerContext());
    }

    @SubscribeMessage(GameSessionEvents.PlayerAbandoned)
    handlePlayerAbandoned(socket: Socket, payload: { roomId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!this.canHandlePlayerAbandon(gameSession)) return;

        const currentPlayer = gameSession.getCurrentPlayer();
        const abandoningPlayer = gameSession.players.find(p => p.socketId === socket.id);
        const wasCurrentPlayer = this.isCurrentPlayerAbandoning(currentPlayer, abandoningPlayer);

        let combatResult: CombatResultPayload | null = null;

        if (gameSession.combat && abandoningPlayer) {
            combatResult = this.combatService.resolveAbandon(gameSession, gameSession.combat, abandoningPlayer.character.id);
            this.clearCombatTimer(gameSession.roomId);
            gameSession.combat = null;
            if (combatResult) this.emitCombatResult(gameSession, combatResult);
        }

        this.handleAbandonedPlayerFlagPlacement(gameSession, abandoningPlayer);
        this.gameSessionService.removePlayer(payload.roomId, socket.id);

        this.server.to(payload.roomId).emit(GameSessionEvents.PlayerAbandoned, {
            playerId: abandoningPlayer?.character.id,
            mapCopyTiles: gameSession.mapCopy?.tiles,
        });

        if (this.shouldStopAfterPlayerAbandon(gameSession)) return;

        if (wasCurrentPlayer) {
            this.handleTurnEnd(gameSession);
        }

        if (combatResult?.activePlayerWon && !wasCurrentPlayer) this.startGameTurn(gameSession);
    }

    private canHandlePlayerAbandon(gameSession: GameSession | undefined): gameSession is GameSession {
        return Boolean(gameSession && gameSession.status !== SessionStatus.Playing);
    }

    private isCurrentPlayerAbandoning(currentPlayer: Character | null, abandoningPlayer: Player | undefined): boolean {
        return Boolean(currentPlayer && abandoningPlayer && currentPlayer.id === abandoningPlayer.character.id);
    }

    private shouldStopAfterPlayerAbandon(gameSession: GameSession): boolean {
        return (
            !this.handleAbandonedPlayerTeamCheck(gameSession) ||
            !this.handleAbandonedPlayerWinnerCheck(gameSession) ||
            this.handleAbandonedPlayerEmptyGame(gameSession)
        );
    }

    private handleAbandonedPlayerFlagPlacement(gameSession: GameSession, abandoningPlayer: Player | undefined): void {
        if (gameSession.gameMode === 'ctf' && abandoningPlayer?.character.hasFlag && abandoningPlayer.character.position) {
            const freeTile = this.gameSessionService.findNearestFreeTile(gameSession, abandoningPlayer.character.position);
            if (freeTile) {
                gameSession.setFlagPosition(freeTile);
                gameSession.setFlagHolder(null);
            }
        }
    }

    private handleAbandonedPlayerTeamCheck(gameSession: GameSession): boolean {
        if (gameSession.gameMode === 'ctf') {
            const team1Count = gameSession.getTotalPlayersInTeam('team1');
            const team2Count = gameSession.getTotalPlayersInTeam('team2');

            if (team1Count === 0 || team2Count === 0) {
                this.handleGameEndCanceled(gameSession);
                return false;
            }
        }
        return true;
    }

    private handleAbandonedPlayerWinnerCheck(gameSession: GameSession): boolean {
        const winner = this.gameSessionService.checkGameWinner(gameSession);
        if (winner) {
            this.handleGameEnd(gameSession, winner);
            return false;
        }
        return true;
    }

    private handleAbandonedPlayerEmptyGame(gameSession: GameSession): boolean {
        if (gameSession.playerOrder.length <= 1) {
            this.handleGameEnd(gameSession, null);
            return true;
        }
        return false;
    }

    private startGameTurn(gameSession: GameSession): void {
        this.handlersProvider.turnHandler.startGameTurn(
            gameSession,
            this.createHandlerContext(),
        );
    }

    private handleTurnEnd(gameSession: GameSession): void {
        this.handlersProvider.turnHandler.handleTurnEnd(
            gameSession,
            this.createHandlerContext(),
            (session: GameSession) => this.startGameTurn(session),
        );
    }

    private handleGameEnd(gameSession: GameSession, winner: Character | null): void {
        this.gameSessionService.cleanupTurnTimers(gameSession.roomId);
        this.clearCombatTimer(gameSession.roomId);
        gameSession.combat = null;

        const winningTeam = winner && gameSession.gameMode === 'ctf' ? gameSession.getPlayerTeam(winner.id) : null;

        this.server.to(gameSession.roomId).emit(GameSessionEvents.GameEnded, {
            winner: winner ? { id: winner.id, name: winner.name, avatarId: winner.avatarId } : null,
            winningTeam,
            gameMode: gameSession.gameMode,
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
        }, this.combatTickInterval);

        this.combatTimers.set(gameSession.roomId, timer);
    }

    private resolveCombatRound(gameSession: GameSession): void {
        this.clearCombatTimer(gameSession.roomId);

        const combat = gameSession.combat;

        const { result } = this.combatService.resolveRound(gameSession, combat, gameSession.isDebugModeActivated);

        if (!result) {
            this.emitCombatState(gameSession, GameSessionEvents.CombatUpdated);
            return this.startCombatTimer(gameSession);
        }

        gameSession.combat = null;
        this.emitCombatResult(gameSession, result);

        const winner = this.gameSessionService.checkGameWinner(gameSession);
        if (winner) return this.handleGameEnd(gameSession, winner);

        if (result.activePlayerWon) return this.startGameTurn(gameSession);

        this.gameSessionService.endCurrentTurn(gameSession);
        this.handleTurnEnd(gameSession);
    }

    private emitCombatState(gameSession: GameSession, event: GameSessionEvents.CombatStarted | GameSessionEvents.CombatUpdated): void {
        const combat = gameSession.combat;
        if (!combat) return;

        gameSession.players
            .filter((player) => [combat.attacker.id, combat.defender.id].includes(player.character.id))
            .map((player) => player.socketId)
            .forEach((socketId) => {
                this.server.to(socketId).emit(event, combat);
            });
    }

    private emitCombatResult(gameSession: GameSession, result: CombatResultPayload): void {
        this.server.to(gameSession.roomId).emit(GameSessionEvents.CombatResult, result);
    }

    private clearCombatTimer(roomId: string): void {
        const timer = this.combatTimers.get(roomId);
        if (timer) clearInterval(timer);
        this.combatTimers.delete(roomId);
    }

    private handleGameEndCanceled(gameSession: GameSession): void {
        this.gameSessionService.cleanupTurnTimers(gameSession.roomId);

        this.server.to(gameSession.roomId).emit(GameSessionEvents.GameEnded, {
            winner: null,
            reason: 'canceled',
            gameMode: gameSession.gameMode,
        });

        setTimeout(() => {
            this.gameSessionGateway.cleanUpRoom(gameSession.roomId);
        }, this.gameEndCleanupDelay);
    }

    private emitReachableTiles(gameSession: GameSession): void {
        const currentPlayer = gameSession.getCurrentPlayer();
        const playerData = gameSession.players.find(p => p.character.id === currentPlayer.id);
        const reachableTiles = this.gameSessionService.getReachableTiles(gameSession);
        this.server.to(playerData.socketId).emit(GameSessionEvents.ReachableTiles, {
            playerId: currentPlayer.id,
            tiles: reachableTiles,
        });
    }

    private findAndSetFlagPosition(gameSession: GameSession, mapData: GameDataForInit): void {
        const tiles = mapData.mapConfig.tiles;
        for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) {
                if (tiles[y][x].object?.type === 'flag') {
                    const position = { x, y };
                    const tile = tiles[y][x];
                    if (tile.type !== 'door' || tile.doorState !== 'opened') {
                        gameSession.setFlagPosition(position);
                        return;
                    }
                }
            }
        }
    }

    private createHandlerContext(): GamePlayHandlerContext {
        return {
            server: this.server,
            onGameEnd: (gameSession: GameSession, winner: Character | null) => this.handleGameEnd(gameSession, winner),
            onTurnEnd: (gameSession: GameSession) => this.handleTurnEnd(gameSession),
            emitReachableTiles: (gameSession: GameSession) => this.emitReachableTiles(gameSession),
        };
    }

    @SubscribeMessage(GameSessionEvents.RequestFlagTransfer)
    handleRequestFlagTransfer(socket: Socket, payload: { roomId: string; toPlayerId: string }) {
        this.handlersProvider.ctfHandler.handleRequestFlagTransfer(socket, payload, this.createHandlerContext());
    }

    @SubscribeMessage(GameSessionEvents.FlagTransferResponse)
    handleFlagTransferResponse(socket: Socket, payload: { roomId: string; fromPlayerId: string; accepted: boolean }) {
        this.handlersProvider.ctfHandler.handleFlagTransferResponse(socket, payload, this.createHandlerContext());
    }
}
