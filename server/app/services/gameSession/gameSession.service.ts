import { Character } from '@common/character';
import { GameSession, Position } from '@common/gameSession';
import { Injectable, Logger } from '@nestjs/common';
import { CombatResult, CombatService } from './combat.service';
import { MovementService } from './movement.service';
import { StartingPointService } from './starting-point.service';
import { TurnManagementService } from './turn-management.service';

interface MapTile {
    type: string;
    object?: { type: string };
}

interface GameMap {
    tiles: MapTile[][];
}

@Injectable()
export class GameSessionService {

    private logger = new Logger(GameSessionService.name);
    private gameSessions: Map<string, GameSession> = new Map();

    constructor(
        private startingPointService: StartingPointService,
        private turnManagementService: TurnManagementService,
        private movementService: MovementService,
        private combatService: CombatService,
    ) {}

    createGameSession(socketId: string, hostPlayer: Character, mapId: string): GameSession {
        hostPlayer.id = socketId;
        hostPlayer.socketId = socketId;
        const newGameSession = new GameSession(hostPlayer, mapId);
        this.gameSessions.set(newGameSession.getRoomId(), newGameSession);
        return newGameSession;
    }

    joinSession(roomId: string, socketId: string, player: Character): string | null {
        const session = this.gameSessions.get(roomId);
        if (!session) return 'Session de jeu introuvable';
        if (session.getStatus() !== 'waiting') return 'La session de jeu a déjà commencé';
        if (session.isFull()) return 'La session de jeu est pleine';
        player.id = socketId;
        player.socketId = socketId;
        session.addPlayer(player);
        return null;
    }

    kickPlayer(roomId: string, targetSocketId: string): void {
        const session = this.gameSessions.get(roomId);
        if (session) {
            const playerToKick = session.getPlayers().find(p => p.socketId === targetSocketId);
            if (playerToKick) {
                session.removePlayer(playerToKick.character);
            }
        }
    }

    getGameSession(roomId: string): GameSession {
        return this.gameSessions.get(roomId);
    }

    getAvailableGameSessions(): GameSession[] {
        return Array.from(this.gameSessions.values()).filter(session =>
            session.getStatus() === 'waiting' && session.getPlayers().length < session.getMaxPlayers());
    }

    deleteGameSession(roomId: string): void {
        this.gameSessions.delete(roomId);
    }

    initializeGameSession(gameSession: GameSession, mapConfig: GameMap): void {
        this.turnManagementService.establishTurnOrder(gameSession);
        this.startingPointService.assignStartingPoints(gameSession, mapConfig);
        this.startingPointService.cleanupUnusedStartingPoints(gameSession, mapConfig.tiles);
        gameSession.setMapCopy(mapConfig);
        gameSession.setStatus('playing');
        this.logger.log(`Game session ${gameSession.getRoomId()} initialized`);
    }

    async startCurrentTurn(gameSession: GameSession, onStartCallback: () => void): Promise<void> {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) {
            throw new Error('No current player found');
        }
        this.movementService.resetMovementPoints(currentPlayer);
        await this.turnManagementService.startTurnWithDelay(gameSession, onStartCallback);
        this.turnManagementService.startTurnTimer(gameSession, () => {
            this.endCurrentTurn(gameSession);
        });
    }

    endCurrentTurn(gameSession: GameSession): void {
        this.turnManagementService.endTurn(gameSession);
    }

    getReachableTiles(gameSession: GameSession): Position[] {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) {
            return [];
        }
        const mapData = gameSession.getMapCopy().tiles;
        return this.movementService.getReachableTiles(
            gameSession,
            currentPlayer.position,
            currentPlayer.speed,
            mapData,
        );
    }

    executeMove(
        gameSession: GameSession,
        direction: 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight',
    ): boolean {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) {
            return false;
        }
        const mapData = gameSession.getMapCopy().tiles;
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
        const defender = gameSession.getPlayers().find(p => p.character.id === defenderId)?.character;
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

    removePlayer(roomId: string, playerId: string): void {
        const gameSession = this.gameSessions.get(roomId);
        if (!gameSession) {
            return;
        }
        const playerData = gameSession.getPlayers().find(p => p.character.id === playerId);
        if (playerData) {
            gameSession.removePlayer(playerData.character);
        }
    }

    getAllGameSessions(): GameSession[] {
        return Array.from(this.gameSessions.values());
    }
}