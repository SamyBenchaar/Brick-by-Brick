import { GameSession } from '@app/domain/game-session';
import { GameDataForInit } from '@app/interfaces/game-map-interfaces';
import { CombatService } from '@app/services/game-session/combat.service';
import { findNearestFreeTilePosition } from '@app/services/game-session/game-session/game-session-pathfinding.util';
import { MovementService } from '@app/services/game-session/movement.service';
import { SanctuaryService } from '@app/services/game-session/sanctuary.service';
import { StartingPointService } from '@app/services/game-session/starting-point.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { VirtualPlayerService } from '@app/services/game-session/virtual-player.service';
import { GameService } from '@app/services/game/game.service';
import { getGameSizeConfig } from '@app/utils/game-config.utils';
import { Character } from '@common/character';
import { AVATAR_IDS } from '@common/constants/avatar-constants';
import { GameModeValue } from '@common/constants/game-config-constants';
import { Direction } from '@common/constants/key-event.constants';
import { VIRTUAL_PLAYER_ID_PREFIX, VIRTUAL_PLAYER_NAMES } from '@common/constants/virtual-player-constants';
import { Dice } from '@common/dice';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { SessionStatus } from '@common/session.status';
import { VirtualPlayerProfile } from '@common/virtual.player.profile';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';

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
        this.logger.log(`Game session ${gameSession.roomId} initialisée`);
    }

    async startCurrentTurn(
        gameSession: GameSession,
        onStartCallback: () => void,
        onTickCallback?: (timeRemaining: number) => void,
        onTurnEndCallback?: (endedPlayerId: string) => void,
    ): Promise<void> {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) {
            throw new Error('Aucun joueur courant trouvé');
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

        const fullCurrentPlayer = gameSession.players.find(player => player.character.id === currentPlayer.id);
        if (fullCurrentPlayer?.virtualProfile) {
            this.virtualPlayerService.playTurn(gameSession, fullCurrentPlayer)
                .catch((error: Error) => {
                    this.logger.error(`Erreur durant le tour JV: ${error.message}`);
                })
                .finally(() => {
                    if (!gameSession.getActiveCombat()) {
                        endTurnSafely();
                    }
                });
        }
    }

    endCurrentTurn(gameSession: GameSession): void {
        this.turnManagementService.endTurn(gameSession);
    }

    getReachableTiles(gameSession: GameSession): Position[] {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer || !currentPlayer.position || !currentPlayer.remainingMovement) {
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
        direction: Direction,
    ): boolean {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer || !currentPlayer.position || !currentPlayer.remainingMovement) {
            return false;
        }
        const mapData = gameSession.getMapCopy()?.tiles;
        if (!mapData) {
            return false;
        }
        const success = this.movementService.executeMove(
            gameSession, currentPlayer, direction, mapData,
        );
        return success;
    }

    checkGameWinner(gameSession: GameSession): Character | null {
        if (gameSession.gameMode === GameModeValue.Ctf) {
            return null;
        }

        const players = gameSession.getActivePlayers();
        return this.combatService.checkGameWinCondition(players);
    }

    checkCtfFlagWinner(gameSession: GameSession): Character | null {
        if (gameSession.gameMode !== GameModeValue.Ctf) {
            return null;
        }

        const flagHolder = gameSession.getFlagHolderCharacter();
        if (!flagHolder) {
            return null;
        }

        const start = gameSession.getStartingPoint(flagHolder.id);
        if (!start || !flagHolder?.position) {
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
        const canTransferOrRequestFlag = this.canCurrentPlayerTransferOrRequestFlag(gameSession, currentPlayer);

        return canMove || canInteract || canFight || canTransferOrRequestFlag;
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
        const isDoorAdjacent = this.movementService.isDoorAdjacent(currentPlayer.position, gameSession);
        if (isDoorAdjacent) {
            return true;
        }
        const isSanctuaryAdjacent = this.movementService.isSanctuaryAdjacent(currentPlayer.position, gameSession);
        if (isSanctuaryAdjacent) {
            const tiles = gameSession.getMapCopy()?.tiles || [];
            const canInteractWithSanctuary = this.sanctuaryService.canInteractWithSanctuary(isSanctuaryAdjacent, tiles);
            return canInteractWithSanctuary;
        }
        return false;
    }

    private canCurrentPlayerFight(gameSession: GameSession, currentPlayer: Character): boolean {
        const adjacentPlayers = this.movementService.getAdjacentPlayers(gameSession, currentPlayer.position);
        return adjacentPlayers.some((adjacentPlayer) =>
            this.combatService.canFight(currentPlayer, adjacentPlayer, gameSession),
        );
    }

    private canCurrentPlayerTransferOrRequestFlag(gameSession: GameSession, currentPlayer: Character): boolean {
        if (gameSession.gameMode !== GameModeValue.Ctf) return false;
        if ((currentPlayer.remainingActions ?? 0) <= 0) return false;

        const adjacentPlayers = this.movementService.getAdjacentPlayers(gameSession, currentPlayer.position);
        for (const adjacentPlayer of adjacentPlayers) {
            if (adjacentPlayer.team === currentPlayer.team) {
                const currentHasFlag = currentPlayer.hasFlag;
                const adjacentHasFlag = adjacentPlayer.hasFlag;
                if ((currentHasFlag && !adjacentHasFlag) || (!currentHasFlag && adjacentHasFlag)) {
                    return true;
                }
            }
        }
        return false;
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
        const availableNames = VIRTUAL_PLAYER_NAMES.filter((validName) => session.isNameUnique(validName));
        const name = availableNames.length > 0 ? this.pickRandom(availableNames) : session.verifyUniqueName(this.pickRandom(VIRTUAL_PLAYER_NAMES));
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
                defeats: 0,
                totalDamageDealt: 0,
                totalDamageReceived: 0,
                tilesVisited: 0,
            },
        };
    }

    private pickRandom<T>(items: T[]): T {
        return items[Math.floor(Math.random() * items.length)];
    }

    findNearestFreeTile(gameSession: GameSession, fromPosition: Position): Position | null {
        return findNearestFreeTilePosition(gameSession, fromPosition);
    }
}