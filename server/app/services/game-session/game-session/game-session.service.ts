import { GameSession } from '@app/domain/game-session';
import { TileDto } from '@app/dto/tile.dto';
import { CombatResult, GameDataForInit } from '@app/interfaces/game-map-interfaces';
import { CombatService } from '@app/services/game-session/combat.service';
import { MovementService } from '@app/services/game-session/movement.service';
import { StartingPointService } from '@app/services/game-session/starting-point.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { VirtualPlayerService } from '@app/services/game-session/virtual-player.service';
import { GameService } from '@app/services/game/game.service';
import { Character } from '@common/character';
import { AVATAR_IDS } from '@common/constants/avatar-constants';
import { getGameSizeConfig } from '@common/constants/game-config-constants';
import { VIRTUAL_PLAYER_ID_PREFIX, VIRTUAL_PLAYER_NAMES } from '@common/constants/virtual-player-constants';
import { Dice } from '@common/dice';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { SessionStatus } from '@common/session.status';
import { VirtualPlayerProfile } from '@common/virtual.player.profile';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { SanctuaryService } from '@app/services/game-session/sanctuary.service';

const BASE_LIFE = 6;
const BASE_SPEED = 6;
const BASE_ATTACK = 4;
const BASE_DEFENSE = 4;
const BASE_ACTIONS = 1;
const BONUS_AMOUNT = 2;
const LIFE_BONUS_THRESHOLD = 0.5;

@Injectable()
export class GameSessionService {

    private logger = new Logger(GameSessionService.name);
    private gameSessions: Map<string, GameSession> = new Map();
    @Inject() private virtualPlayerService: VirtualPlayerService;
    @Inject() private sanctuaryService: SanctuaryService;

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

        const newGameSession = new GameSession(player, mapId, originalGame.gameMode);
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

    addVirtualPlayer(roomId: string, profile: VirtualPlayerProfile): string | null {
        const session = this.gameSessions.get(roomId);

        if (!session) return 'Session de jeu introuvable';
        if (session.status !== SessionStatus.Waiting) return 'La session de jeu a déjà commencé';
        if (session.isFull()) return 'La session de jeu est pleine';

        const virtualPlayer = this.createVirtualPlayer(session, profile);
        if (!virtualPlayer) {
            return 'Aucun avatar disponible pour ajouter un joueur virtuel';
        }

        session.addPlayer(virtualPlayer);
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
        this.sanctuaryService.initializeSanctuaryOrigins(mapConfig.tiles);
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

        const endTurnSafely = () => {
            const activePlayer = gameSession.getCurrentPlayer();
            if (!activePlayer || activePlayer.id !== endedPlayerId) {
                return;
            }

            this.endCurrentTurn(gameSession);
            if (onTurnEndCallback) {
                onTurnEndCallback(endedPlayerId);
            }
        };

        // The turn may already be ended in onStartCallback (for example when no action is possible).
        if (gameSession.getCurrentPlayer()?.id !== endedPlayerId) {
            return;
        }

        this.turnManagementService.startTurnTimer(
            gameSession,
            () => {
                endTurnSafely();
            },
            onTickCallback,
        );

        const fullCurrentPlayer = gameSession.players.find(p => p.character.id === currentPlayer.id);
        if (fullCurrentPlayer?.virtualProfile) {
            this.virtualPlayerService.playTurn(gameSession, fullCurrentPlayer)
                .catch((error: Error) => {
                    this.logger.error(`Erreur durant le tour JV: ${error.message}`);
                })
                .finally(() => {
                    endTurnSafely();
                });
        }
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
        if (!this.combatService.canFight(attacker, defender, gameSession)) {
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

    checkCtfFlagWinner(gameSession: GameSession): Character | null {
        if (gameSession.gameMode !== 'ctf') {
            return null;
        }

        const flagHolder = gameSession.getFlagHolderCharacter();
        if (!flagHolder?.position) {
            return null;
        }

        const start = gameSession.getStartingPoint(flagHolder.id);
        if (!start) {
            return null;
        }

        const hasReturnedFlag = flagHolder.position.x === start.x && flagHolder.position.y === start.y;
        return hasReturnedFlag ? flagHolder : null;
    }

    canPlayerTakeAction(gameSession: GameSession): boolean {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer || !currentPlayer.position) {
            return false;
        }

        const canMove = this.canCurrentPlayerMove(gameSession);
        const canInteract = this.canCurrentPlayerInteract(gameSession, currentPlayer);
        const canFight = this.canCurrentPlayerFight(gameSession, currentPlayer);

        return canMove || canInteract || canFight;
    }

    private canCurrentPlayerMove(gameSession: GameSession): boolean {
        const reachableTiles = this.getReachableTiles(gameSession);
        return reachableTiles.length > 1;
    }

    private canCurrentPlayerInteract(gameSession: GameSession, currentPlayer: Character): boolean {
        const hasRemainingActions = (currentPlayer.remainingActions ?? 0) > 0;
        if (!hasRemainingActions) {
            return false;
        }

        return this.movementService.isDoorAdjacent(currentPlayer.position, gameSession);
    }

    private canCurrentPlayerFight(gameSession: GameSession, currentPlayer: Character): boolean {
        const hasRemainingActions = (currentPlayer.remainingActions ?? 0) > 0;
        if (!hasRemainingActions) {
            return false;
        }

        const adjacentPlayers = this.movementService.getAdjacentPlayers(gameSession, currentPlayer.position);
        return adjacentPlayers.some((adjacentPlayer) =>
            this.combatService.canFight(currentPlayer, adjacentPlayer, gameSession),
        );
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

    private createVirtualPlayer(session: GameSession, profile: VirtualPlayerProfile): Player | null {
        const availableAvatarIds = AVATAR_IDS.filter((availableAvatarId) => !session.getTakenAvatars().includes(availableAvatarId));
        if (availableAvatarIds.length === 0) {
            return null;
        }

        const socketId = `${VIRTUAL_PLAYER_ID_PREFIX}_${crypto.randomUUID()}`;
        const avatarId = this.pickRandom(availableAvatarIds);
        const baseName = this.pickRandom(VIRTUAL_PLAYER_NAMES);
        const name = session.verifyUniqueName(baseName);
        const bonusTarget = Math.random() < LIFE_BONUS_THRESHOLD ? 'life' : 'speed';

        const speed = bonusTarget === 'speed' ? BASE_SPEED + BONUS_AMOUNT : BASE_SPEED;
        const maxLife = bonusTarget === 'life' ? BASE_LIFE + BONUS_AMOUNT : BASE_LIFE;

        return {
            socketId,
            virtualProfile: profile,
            character: {
                id: socketId,
                isActif: false,
                battlesWon: 0,
                name,
                avatarId,
                maxLife,
                life: maxLife,
                speed,
                attack: BASE_ATTACK,
                defense: BASE_DEFENSE,
                movements: speed,
                actions: BASE_ACTIONS,
                attackDice: Dice.D4,
                defenseDice: Dice.D6,
            },
        };
    }

    private pickRandom<T>(items: T[]): T {
        return items[Math.floor(Math.random() * items.length)];
    }

    findNearestFreeTile(gameSession: GameSession, fromPosition: Position): Position | null {
        if (!gameSession.mapCopy) {
            return null;
        }

        const mapData = gameSession.mapCopy.tiles;
        const height = mapData.length;
        const width = mapData[0].length;

        const queue: { pos: Position; distance: number }[] = [{ pos: fromPosition, distance: 0 }];
        const visited = new Set<string>();
        visited.add(`${fromPosition.x},${fromPosition.y}`);

        const directions = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 },
        ];

        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) {
                break;
            }
            const { pos, distance } = item;

            if (this.isFreeTile(gameSession, pos, mapData)) {
                return pos;
            }

            for (const dir of directions) {
                const nextPos = { x: pos.x + dir.x, y: pos.y + dir.y };
                const key = `${nextPos.x},${nextPos.y}`;

                if (!visited.has(key) && nextPos.x >= 0 && nextPos.x < width && nextPos.y >= 0 && nextPos.y < height) {
                    visited.add(key);
                    queue.push({ pos: nextPos, distance: distance + 1 });
                }
            }
        }

        return null;
    }

    private isFreeTile(gameSession: GameSession, position: Position, mapData: TileDto[][]): boolean {
        const tile = mapData[position.y][position.x];

        if (tile.type === 'wall') {
            return false;
        }

        if (tile.type === 'door' && tile.doorState === 'opened') {
            return false;
        }

        if (tile.object) {
            return false;
        }

        const hasPlayer = gameSession.players.some(
            p => p.character.position?.x === position.x && p.character.position?.y === position.y,
        );
        if (hasPlayer) {
            return false;
        }

        return true;
    }
}