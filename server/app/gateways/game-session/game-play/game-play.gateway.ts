import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GamePlayHandlersProvider } from '@app/gateways/game-session/game-play/game-play-handlers.provider';
import { GameSessionGateway } from '@app/gateways/game-session/game-session/game-session.gateway';
import { GameDataForInit } from '@app/interfaces/game-map-interfaces';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { LogService } from '@app/services/log/log.service';
import { Character } from '@common/character';
import { MS_TO_SECONDS_CONVERSION } from '@common/constants/game-statistics-constants';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { PERCENTAGE_MULTIPLIER, TileType } from '@common/map';
import { Position } from '@common/position';
import { SessionStatus } from '@common/session.status';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
    OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameModeValue } from '@common/constants/game-config-constants';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';

@WebSocketGateway({ cors: true })
@Injectable()
export class GamePlayGateway implements OnGatewayInit {
    @WebSocketServer() private server: Server;

    private readonly logger = new Logger(GamePlayGateway.name);

    constructor(
        @Inject(forwardRef(() => GameSessionService))
        private gameSessionService: GameSessionService,
        @Inject(forwardRef(() => GameSessionGateway))
        private gameSessionGateway: GameSessionGateway,
        @Inject(forwardRef(() => GamePlayHandlersProvider))
        private handlersProvider: GamePlayHandlersProvider,
        private logService: LogService,
        private turnManagementService: TurnManagementService,
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

        if (gameSession.gameMode === GameModeValue.Ctf && gameSession.players.length % 2 !== 0) {
            socket.emit(GameSessionEvents.GameSessionJoinError, 'Le mode CTF requiert un nombre pair de joueurs');
            return;
        }

        gameSession.status = SessionStatus.Playing;
        gameSession.startTime = new Date();
        this.gameSessionGateway.notifyGameSessionListUpdated();

        const fullMapData = await this.gameSessionService.getFullMapData(gameSession.mapId);
        this.gameSessionService.initializeGameSession(gameSession, fullMapData);

        if (gameSession.gameMode === GameModeValue.Ctf) {
            gameSession.assignTeams();
            this.findAndSetFlagPosition(gameSession, fullMapData);
        }

        if (gameSession.gameMode === GameModeValue.Ctf) {
            this.server.to(payload.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }

        this.server.to(payload.roomId).emit(GameSessionEvents.GameStarted, {
            roomId: payload.roomId,
            mapData: fullMapData,
            gameSession,
        });

        this.logService.log(payload.roomId, 'La partie a commencé');

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

        const action = newIsDebugModeActivated ? 'Activation' : 'Désactivation';
        const hostName = gameSession.host.character.name;
        this.logService.log(payload.currentRoomId, `${action} du mode de débogage par ${hostName}`);
    }

    @SubscribeMessage(GameSessionEvents.EndTurnRequest)
    handleEndTurnRequest(socket: Socket, payload: { roomId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        if (gameSession.isTurnStarting || gameSession.getActiveCombat()) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find(player => player.socketId === socket.id);
        if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id && !gameSession.isDebugModeActivated) {
            return;
        }

        this.gameSessionService.endCurrentTurn(gameSession);
        this.handleTurnEnd(gameSession);
    }

    @SubscribeMessage(GameSessionEvents.RequestMove)
    handleRequestMove(socket: Socket, payload: { roomId: string; direction: string }) {
        this.handlersProvider.movementHandler.handleRequestMove(
            socket,
            payload,
            this.createHandlerContext(),
        );
    }

    @SubscribeMessage(GameSessionEvents.RequestAssignPosition)
    handleRequestAssignPosition(socket: Socket, payload: { roomId: string; position: Position }) {
        this.handlersProvider.movementHandler.handleRequestAssignPosition(
            socket,
            payload,
            this.createHandlerContext(),
        );
    }

    @SubscribeMessage(CombatEvents.RequestCombat)
    handleRequestCombat(socket: Socket, payload: { roomId: string; defenderId: string }) {
        this.handlersProvider.combatHandler.handleRequestCombat(
            socket,
            payload,
            this.createHandlerContext(),
        );
    }

    @SubscribeMessage(CombatEvents.SubmitCombatPosture)
    handleSubmitCombatPosture(socket: Socket, payload: { roomId: string; posture: string }) {
        this.handlersProvider.combatHandler.handlePostureChosen(
            socket,
            payload,
            this.createHandlerContext(),
        );
    }

    triggerBotCombat(roomId: string, attackerId: string, defenderId: string): void {
        const gameSession = this.gameSessionService.getGameSession(roomId);
        if (!gameSession) return;
        const attacker = gameSession.players.find(player => player.character.id === attackerId)?.character;
        const defender = gameSession.players.find(player => player.character.id === defenderId)?.character;
        if (!attacker || !defender) return;

        this.handlersProvider.combatHandler.initiateVirtualPlayerCombat(
            gameSession,
            attacker,
            defenderId,
            this.createHandlerContext(),
        );
    }

    @SubscribeMessage(GameSessionEvents.PlayerAbandoned)
    handlePlayerAbandoned(socket: Socket, payload: { roomId: string }) {
        this.handlersProvider.abandonHandler.handlePlayerAbandoned(socket, payload, this.createHandlerContext());
    }

    @SubscribeMessage(GameSessionEvents.RequestInteract)
    handleRequestInteract(socket: Socket, payload: { roomId: string; position: Position; mode: 'normal' | 'double' }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) return;
        if (gameSession.isTurnStarting || gameSession.getActiveCombat()) return;
        const tile = gameSession.mapCopy?.tiles[payload.position.y]?.[payload.position.x];
        if (!tile) return;
        if (tile.type === 'door') {
            this.handlersProvider.movementHandler.handleRequestInteract(socket, payload, this.createHandlerContext());
        } else if (tile.object?.type === 'healingsanctuary' || tile.object?.type === 'combatsanctuary') {
            this.handlersProvider.sanctuaryHandler.handleRequestInteract(socket, payload, this.createHandlerContext());
        }
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

    handleResumeTurn(gameSession: GameSession): void {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) return;
        this.turnManagementService.resumeTurnTimer(
            gameSession,
            () => {
                this.gameSessionService.endCurrentTurn(gameSession);
                this.handleTurnEnd(gameSession);
            },
            (timeRemaining) => {
                this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnTimeUpdate, { timeRemaining });
            },
        );
        this.server.to(gameSession.roomId).emit(GameSessionEvents.TurnStarted, {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            turnTime: gameSession.getCurrentTurnTime(),
            remainingMovement: currentPlayer.remainingMovement,
            remainingActions: currentPlayer.remainingActions,
        });
    }
    private handleGameEnd(gameSession: GameSession, winner: Character | null): void {
        this.gameSessionService.cleanupTurnTimers(gameSession.roomId);

        const winningTeam = winner && gameSession.gameMode === GameModeValue.Ctf ? gameSession.getPlayerTeam(winner.id) : null;
        const allVisitedTiles = new Set<string>();
        gameSession.visitedTiles.forEach(playerTiles =>
            playerTiles.forEach(tile => allVisitedTiles.add(tile)),
        );

        const durationSeconds = gameSession.startTime
            ? Math.floor((Date.now() - gameSession.startTime.getTime()) / MS_TO_SECONDS_CONVERSION)
            : 0;
        const mapTiles = gameSession.mapCopy?.tiles ?? [];
        let totalSanctuaries = 0;
        mapTiles.forEach((row, y) => row.forEach((tile, x) => {
            if (tile.sanctuaryOrigin?.x === x && tile.sanctuaryOrigin?.y === y) totalSanctuaries++;
        }));

        let walkableTiles = 0;
        mapTiles.forEach(row => row.forEach(tile => {
            if (tile.type === TileType.Base || tile.type === TileType.Water || tile.type === TileType.Ice) {
                walkableTiles++;
            }
        }));

        let totalDoors = 0;
        mapTiles.forEach(row => row.forEach(tile => {
            if (tile.type === TileType.Door) totalDoors++;
        }));

        const tilesVisitedPercent = walkableTiles > 0
            ? Math.round((allVisitedTiles.size / walkableTiles) * PERCENTAGE_MULTIPLIER)
            : 0;
        const sanctuariesUsedPercent = totalSanctuaries > 0
            ? Math.round((gameSession.usedSanctuaries.size / totalSanctuaries) * PERCENTAGE_MULTIPLIER)
            : null;
        const doorsUsedPercent = totalDoors > 0
            ? Math.round((gameSession.usedDoors.size / totalDoors) * PERCENTAGE_MULTIPLIER)
            : null;

        this.server.to(gameSession.roomId).emit(GameSessionEvents.GameEnded, {
            winner: winner ? { id: winner.id, name: winner.name, avatarId: winner.avatarId } : null,
            winningTeam,
            gameMode: gameSession.gameMode,
            reason: winner ? 'victory' : 'noPlayers',
            players: gameSession.players,
            durationSeconds,
            totalTurns: gameSession.totalTurns,
            sanctuariesUsedPercent,
            tilesVisitedPercent,
            doorsUsedPercent,
            flagHoldersCount: gameSession.gameMode === GameModeValue.Ctf ? gameSession.flagHolders.size : null,
            leftPlayers: gameSession.leftPlayers,
        });

        const activePlayers = gameSession.players.map(player => player.character.name).join(', ');
        this.logService.log(gameSession.roomId, `Fin de partie. Joueurs actifs: ${activePlayers}`);


    }

    private handleGameEndCanceled(gameSession: GameSession): void {
        this.gameSessionService.cleanupTurnTimers(gameSession.roomId);

        this.server.to(gameSession.roomId).emit(GameSessionEvents.GameEnded, {
            winner: null,
            reason: 'canceled',
            gameMode: gameSession.gameMode,
        });

    }

    private emitReachableTiles(gameSession: GameSession): void {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) {
            return;
        }

        const playerData = gameSession.players.find(player => player.character.id === currentPlayer.id);
        if (!playerData) {
            return;
        }

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
            logService: this.logService,
            onGameEnd: (gameSession: GameSession, winner: Character | null) => this.handleGameEnd(gameSession, winner),
            onGameEndCanceled: (gameSession: GameSession) => this.handleGameEndCanceled(gameSession),
            onTurnEnd: (gameSession: GameSession) => this.handleTurnEnd(gameSession),
            emitReachableTiles: (gameSession: GameSession) => this.emitReachableTiles(gameSession),
            resumeTurn: (gameSession: GameSession)=>this.handleResumeTurn(gameSession),
        };
    }

    @SubscribeMessage(GameSessionEvents.RequestFlagTransfer)
    handleRequestFlagTransfer(socket: Socket, payload: { roomId: string; toPlayerId: string }) {
        this.handlersProvider.ctfHandler.handleRequestFlagTransfer(
            socket,
            payload,
            this.createHandlerContext(),
        );
    }

    @SubscribeMessage(GameSessionEvents.FlagTransferResponse)
    handleFlagTransferResponse(socket: Socket, payload: { roomId: string; fromPlayerId: string; accepted: boolean }) {
        this.handlersProvider.ctfHandler.handleFlagTransferResponse(
            socket,
            payload,
            this.createHandlerContext(),
        );
    }
}
