import { GameSession } from '@app/domain/game-session';
import { CombatResult, GameDataForInit } from '@app/interfaces/game-map-interfaces';
import { GameService } from '@app/services/game/game.service';
import { Character } from '@common/character';
import { getGameSizeConfig } from '@common/constants/game-config-constants';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { CombatService } from '@app/services/game-session/combat.service';
import { MovementService } from '@app/services/game-session/movement.service';
import { StartingPointService } from '@app/services/game-session/starting-point.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { SessionStatus } from '@common/session.status';

@Injectable()
export class GameSessionService {

    private logger = new Logger(GameSessionService.name);
    private gameSessions: Map<string, GameSession> = new Map();

    constructor(
        private startingPointService: StartingPointService,
        private turnManagementService: TurnManagementService,
        private movementService: MovementService,
        private combatService: CombatService,
        @Inject(forwardRef(() => GameService))
        private gameService: GameService,
    ) {}

    async createGameSession(player: Player, mapId: string): Promise<GameSession> {
        const originalGame = await this.gameService.findOne(mapId);
        const mapCopy = JSON.parse(JSON.stringify(originalGame));

        const newGameSession = new GameSession(player, mapId);
        newGameSession.mapCopy = mapCopy;
        newGameSession.maxPlayers = getGameSizeConfig(mapCopy.mapConfig.size).maxPlayers;

        this.gameSessions.set(newGameSession.roomId, newGameSession);
        return newGameSession;
    }

    joinSession(roomId: string, player: Player): string | null {
        const session = this.gameSessions.get(roomId);

        if (!session) return 'Session de jeu introuvable';
        if (session.status !== SessionStatus.Waiting) return 'La session de jeu a déjà commencé';
        if (session.isFull()) return 'La session de jeu est pleine';

        player.character.name = session.verifyUniqueName(player.character.name);
        session.addPlayer(player);
        return null;
    }

    kickPlayer(roomId: string, targetSocketId: string): void {
        const session = this.gameSessions.get(roomId);
        if (session) {
            session.removePlayer(targetSocketId);
        }
    }

    getGameSession(roomId: string): GameSession {
        return this.gameSessions.get(roomId);
    }

    getAvailableGameSessions(): GameSession[] {
        return Array.from(this.gameSessions.values()).filter(session =>
            session.status === SessionStatus.Waiting && session.players.length < session.maxPlayers);
    }

    deleteGameSession(roomId: string): void {
        this.gameSessions.delete(roomId);
    }

    async getFullMapData(mapId: string): Promise<GameDataForInit> {
        const originalGame = await this.gameService.findOne(mapId);
        return JSON.parse(JSON.stringify(originalGame));
    }

    initializeGameSession(gameSession: GameSession, mapData: GameDataForInit): void {
        this.turnManagementService.establishTurnOrder(gameSession);
        const mapConfig = { tiles: mapData.mapConfig.tiles };
        gameSession.setMapCopy(mapConfig);
        this.startingPointService.assignStartingPoints(gameSession, mapConfig);
        this.startingPointService.cleanupUnusedStartingPoints(gameSession, mapConfig.tiles);
        gameSession.setStatus(SessionStatus.Playing);
        this.logger.log(`Game session ${gameSession.roomId} initialized`);
    }

    async startCurrentTurn(
        gameSession: GameSession,
        onStartCallback: () => void,
        onTickCallback?: (timeRemaining: number) => void,
        onTurnEndCallback?: (endedPlayerId: string) => void,
    ): Promise<void> {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) {
            throw new Error('No current player found');
        }

        this.movementService.resetMovementPoints(currentPlayer);
        gameSession.setCurrentTurnTime(this.turnManagementService.getTurnTimeInSeconds());
        onStartCallback();

        const endedPlayerId = currentPlayer.id;

        this.turnManagementService.startTurnTimer(
            gameSession,
            () => {
                this.endCurrentTurn(gameSession);
                if (onTurnEndCallback) {
                    onTurnEndCallback(endedPlayerId);
                }
            },
            onTickCallback,
        );
    }

    endCurrentTurn(gameSession: GameSession): void {
        this.turnManagementService.endTurn(gameSession);
    }

    getReachableTiles(gameSession: GameSession): Position[] {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer || !currentPlayer.position || currentPlayer.remainingMovement === undefined) {
            return [];
        }
        const mapData = gameSession.getMapCopy()?.tiles;
        if (!mapData) {
            return [];
        }
        return this.movementService.getReachableTiles(
            gameSession,
            currentPlayer.position,
            currentPlayer.remainingMovement,
            mapData,
        );
    }

    executeMove(
        gameSession: GameSession,
        direction: 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight',
    ): boolean {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer || !currentPlayer.position || currentPlayer.remainingMovement === undefined) {
            return false;
        }
        const mapData = gameSession.getMapCopy()?.tiles;
        if (!mapData) {
            return false;
        }
        const success = this.movementService.executeMove(
            gameSession,
            currentPlayer,
            direction,
            mapData,
        );
        return success;
    }

    executeCombat(gameSession: GameSession, defenderId: string): CombatResult {
        const attacker = gameSession.getCurrentPlayer();
        const defender = gameSession.players.find(p => p.character.id === defenderId)?.character;
        if (!attacker || !defender) {
            throw new Error('Invalid player IDs');
        }
        if (!this.combatService.canFight(attacker, defender)) {
            throw new Error('Players are not adjacent');
        }
        const result = this.combatService.executeCombat(
            gameSession,
            attacker,
            defender,
            gameSession.getMapCopy(),
        );
        return result;
    }

    checkGameWinner(gameSession: GameSession): Character | null {
        const players = gameSession.getActivePlayers();
        return this.combatService.checkGameWinCondition(players);
    }

    canPlayerTakeAction(gameSession: GameSession): boolean {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer || !currentPlayer.position) {
            return false;
        }

        const reachableTiles = this.getReachableTiles(gameSession);
        const canMove = reachableTiles.length > 1;

        const hasRemainingActions = (currentPlayer.remainingActions ?? 0) > 0;
        const adjacentPlayers = this.movementService.getAdjacentPlayers(
            gameSession,
            currentPlayer.position,
        );
        const canInteract = hasRemainingActions && this.movementService.isDoorAdjacent(currentPlayer.position, gameSession);
        const canFight = hasRemainingActions && adjacentPlayers.length > 0;

        return canMove || canFight || canInteract;
    }

    removePlayer(roomId: string, playerId: string): void {
        const gameSession = this.gameSessions.get(roomId);
        if (!gameSession) {
            return;
        }
        gameSession.removePlayer(playerId);

        if (gameSession.status === SessionStatus.Playing && gameSession.mapCopy) {
            this.startingPointService.cleanupUnusedStartingPoints(gameSession, gameSession.mapCopy.tiles);
        }
    }

    getAllGameSessions(): GameSession[] {
        return Array.from(this.gameSessions.values());
    }

    cleanupTurnTimers(roomId: string): void {
        this.turnManagementService.cleanupTimers(roomId);
    }
}