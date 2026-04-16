import { GameMap } from '@app/interfaces/game-map-interfaces';
import { Character } from '@common/character';
import { ActiveCombat } from '@common/combat';
import { COMBAT_TURN_TIME } from '@common/constants/combat-constants';
import { GameModeValue, MAX_PLAYER, ROOM_ID_LENGTH } from '@common/constants/game-config-constants';
import { SHUFFLE_FACTOR } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { SessionStatus } from '@common/session.status';

type TeamId = 'team1' | 'team2';

interface FlagTransferRequest {
    from: string;
    to: string;
    timestamp: number;
}

export class GameSession {

    players: Player[] = [];
    leftPlayers: Player[] = [];
    status: SessionStatus = SessionStatus.Waiting;
    roomId: string;
    maxPlayers: number;
    mapCopy: GameMap | null = null;
    host: Player;
    mapId: string;
    socketToAvatar: Map<string, number> = new Map();
    visitedTiles: Map<string, Set<string>> = new Map();
    startTime: Date | null = null;
    totalTurns: number = 0;
    usedSanctuaries: Set<string> = new Set();
    usedDoors: Set<string> = new Set();
    flagHolders: Set<string> = new Set();
    playerOrder: string[] = [];
    currentPlayerIndex: number = 0;
    currentTurnTime: number = 30;
    currentInterTurnTime: number = 3;
    activeCombat: ActiveCombat | null = null;
    currentCombatTurnTime: number = COMBAT_TURN_TIME;
    startingPoints: Map<string, Position> = new Map();
    isTurnStarting: boolean = false;
    isDebugModeActivated = false;

    gameMode: string = 'classic';
    playerTeams: Map<string, TeamId> = new Map();
    flagPosition: Position | null = null;
    flagHolderId: string | null = null;
    flagTransferRequests: Map<string, FlagTransferRequest> = new Map();

    constructor(hostplayer: Player, mapId: string, gameMode: string = 'classic') {
        this.host = hostplayer;
        this.roomId = crypto.randomUUID().substring(0, ROOM_ID_LENGTH).toUpperCase();
        this.maxPlayers = MAX_PLAYER;
        this.mapId = mapId;
        this.gameMode = gameMode;
        this.addPlayer(hostplayer);
    }

    addPlayer(player: Player): void {
        this.players = this.players.filter(existingPlayer => existingPlayer.socketId !== player.socketId);
        if (this.status === SessionStatus.Waiting) {
            this.players.push(player);
            this.socketToAvatar.set(player.socketId, player.character.avatarId);
            return;
        }
        const newPlayerList = [...this.players, player];
        this.players = newPlayerList.sort((a, b) => b.character.speed - a.character.speed);
        this.socketToAvatar.set(player.socketId, player.character.avatarId);
    }

    removePlayer(socketId: string): void {
        const existingPlayer = this.players.find((player) => player.socketId === socketId);
        if (!existingPlayer) {
            return;
        }

        this.socketToAvatar.delete(socketId);

        if (this.status === SessionStatus.Waiting
        ) {
            this.players = this.players.filter((p) => p.socketId !== socketId);
            return;
        }

        const index = this.players.findIndex((p) => p.socketId === socketId);
        if (index === -1) {
            return;
        }

        const [removedPlayer] = this.players.splice(index, 1);
        this.leftPlayers.push(removedPlayer);

        const removedOrderIndex = this.playerOrder.indexOf(removedPlayer.character.id);

        this.playerOrder = this.playerOrder.filter((id) => id !== removedPlayer.character.id);
        this.startingPoints.delete(removedPlayer.character.id);

        this.playerTeams.delete(removedPlayer.character.id);

        if (this.flagHolderId === removedPlayer.character.id && this.gameMode === GameModeValue.Ctf) {
            this.dropFlag(removedPlayer.character.position);
        } else if (this.flagHolderId === removedPlayer.character.id) {
            this.flagHolderId = null;
        }

        this.flagTransferRequests.delete(removedPlayer.character.id);

        if (removedOrderIndex !== -1 && removedOrderIndex < this.currentPlayerIndex) {
            this.currentPlayerIndex -= 1;
        }

        if (this.currentPlayerIndex >= this.playerOrder.length && this.playerOrder.length > 0) {
            this.currentPlayerIndex = 0;
        }
    }

    verifyUniqueName(name: string): string {
        let nameToVerify = name;
        let counter = 2;

        while (!this.isNameUnique(nameToVerify)) {
            if (nameToVerify.includes('-')) {
                nameToVerify = nameToVerify.replace(/-\d+$/, `-${counter}`);
            } else {
                nameToVerify = `${name}-${counter}`;
            }
            counter++;
        }
        return nameToVerify;
    }

    isNameUnique(name: string): boolean {
        return !this.players.some(player => player.character.name === name);
    }

    isHost(socketId: string): boolean {
        return this.host.socketId === socketId;
    }

    isFull(): boolean {
        return this.players.length >= this.maxPlayers;
    }

    getTakenAvatars(): number[] {
        return Array.from(this.socketToAvatar.values());
    }

    startGame(): void {
        this.status = SessionStatus.Playing;
    }

    getCharacters(): Character[] {
        return this.players.map(player => player.character);
    }

    setPlayerOrder(order: string[]): void {
        this.playerOrder = order;
    }

    getPlayerOrder(): string[] {
        return this.playerOrder;
    }

    setCurrentPlayerIndex(index: number): void {
        this.currentPlayerIndex = index;
    }

    getCurrentPlayerIndex(): number {
        return this.currentPlayerIndex;
    }

    getCurrentPlayer(): Character | undefined {
        if (this.playerOrder.length === 0) return undefined;
        const currentPlayerId = this.playerOrder[this.currentPlayerIndex];
        return this.players.find(player => player.character.id === currentPlayerId)?.character;
    }

    setCurrentTurnTime(time: number): void {
        this.currentTurnTime = time;
    }

    getCurrentTurnTime(): number {
        return this.currentTurnTime;
    }

    getCurrentInterTurnTime(): number {
        return this.currentInterTurnTime;
    }

    setCurrentInterTurnTime(time: number): void {
        this.currentInterTurnTime = time;
    }

    decrementTurnTime(): void {
        if (this.currentTurnTime > 0) {
            this.currentTurnTime--;
        }
    }

    getActiveCombat(): ActiveCombat | null {
        return this.activeCombat;
    }

    setActiveCombat(activeCombat: ActiveCombat | null): void {
        this.activeCombat = activeCombat;
    }

    getCurrentCombatTurnTime(): number {
        return this.currentCombatTurnTime;
    }

    setCurrentCombatTurnTime(time: number): void {
        this.currentCombatTurnTime = time;
    }

    decrementCombatTurnTime(): void {
        if (this.currentCombatTurnTime > 0) {
            this.currentCombatTurnTime--;
        }
    }

    clearActiveCombat(): void {
        this.activeCombat = null;
        this.currentCombatTurnTime = COMBAT_TURN_TIME;
    }

    isPlayerInActiveCombat(playerId: string): boolean {
        if (!this.activeCombat) {
            return false;
        }

        return this.activeCombat.attackerId === playerId || this.activeCombat.defenderId === playerId;
    }

    setMapCopy(mapData: GameMap): void {
        this.mapCopy = mapData;
    }

    getMapCopy(): GameMap | null {
        return this.mapCopy;
    }

    setStartingPoint(playerId: string, position: Position): void {
        this.startingPoints.set(playerId, position);
    }

    getStartingPoint(playerId: string): Position | undefined {
        return this.startingPoints.get(playerId);
    }

    getStartingPoints(): Map<string, Position> {
        return this.startingPoints;
    }

    getActivePlayers(): Character[] {
        return this.players.filter(player => this.playerOrder.includes(player.character.id)).map(player => player.character);
    }

    getNextPlayerIndex(): number {
        return (this.currentPlayerIndex + 1) % this.playerOrder.length;
    }

    getCharacterById(id: string): Character | undefined {
        return this.players.find(player => player.character.id === id)?.character;
    }

    advanceToNextPlayer(): void {
        this.currentPlayerIndex = this.getNextPlayerIndex();
        this.currentTurnTime = 30;
    }

    setStatus(status: SessionStatus): void {
        this.status = status;
    }

    assignTeams(): void {
        if (this.gameMode !== GameModeValue.Ctf || this.players.length % 2 !== 0) {
            return;
        }

        const shuffledPlayers = [...this.players].sort(() => Math.random() - SHUFFLE_FACTOR);
        const midpoint = shuffledPlayers.length / 2;

        shuffledPlayers.slice(0, midpoint).forEach(player => {
            this.playerTeams.set(player.character.id, 'team1');
            player.character.team = 'team1';
        });

        shuffledPlayers.slice(midpoint).forEach(player => {
            this.playerTeams.set(player.character.id, 'team2');
            player.character.team = 'team2';
        });
    }

    getPlayerTeam(playerId: string): TeamId | undefined {
        return this.playerTeams.get(playerId);
    }

    getTeammates(playerId: string): Character[] {
        const playerTeam = this.playerTeams.get(playerId);
        if (!playerTeam) return [];

        return this.players
            .filter(player => this.playerTeams.get(player.character.id) === playerTeam && player.character.id !== playerId)
            .map(player => player.character);
    }

    getTotalPlayersInTeam(team: TeamId): number {
        return this.players.filter(player => this.playerTeams.get(player.character.id) === team).length;
    }

    getTeamPlayers(team: TeamId): Character[] {
        return this.players
            .filter(player => this.playerTeams.get(player.character.id) === team)
            .map(player => player.character);
    }

    setFlagPosition(position: Position): void {
        this.flagPosition = position;
    }

    getFlagPosition(): Position | null {
        return this.flagPosition;
    }

    setFlagHolder(playerId: string | null): void {
        if (playerId) {
            this.flagPosition = null;
            this.flagHolders.add(playerId);
        }
        this.flagHolderId = playerId;
        this.players.forEach(player => {
            player.character.hasFlag = player.character.id === playerId;
        });
    }

    getFlagHolder(): string | null {
        return this.flagHolderId;
    }

    getFlagHolderCharacter(): Character | undefined {
        if (!this.flagHolderId) return undefined;
        return this.players.find(player => player.character.id === this.flagHolderId)?.character;
    }

    dropFlag(position: Position): void {
        if (this.flagHolderId) {
            this.flagPosition = position;
            this.setFlagHolder(null);
        }
    }

    createFlagTransferRequest(fromId: string, toId: string): void {
        this.flagTransferRequests.set(toId, { from: fromId, to: toId, timestamp: Date.now() });
    }

    getFlagTransferRequest(playerId: string): FlagTransferRequest | undefined {
        return this.flagTransferRequests.get(playerId);
    }

    acceptFlagTransfer(playerId: string): boolean {
        const request = this.flagTransferRequests.get(playerId);
        if (!request) return false;

        this.flagTransferRequests.delete(playerId);

        const currentFlagHolder = this.getFlagHolder();
        const newFlagHolder = currentFlagHolder === request.from ? request.to : request.from;

        this.setFlagHolder(newFlagHolder);
        return true;
    }

    rejectFlagTransfer(playerId: string): void {
        this.flagTransferRequests.delete(playerId);
    }

    rejectPendingFlagTransfersFromPlayer(playerId: string): void {
        const requestsToReject: string[] = [];

        this.flagTransferRequests.forEach((request, toPlayerId) => {
            if (request.from === playerId) {
                requestsToReject.push(toPlayerId);
            }
        });

        requestsToReject.forEach(toPlayerId => this.flagTransferRequests.delete(toPlayerId));
    }

    isTileVisited(playerId: string, position: Position): boolean {
        if (!this.visitedTiles.has(playerId)) {
            this.visitedTiles.set(playerId, new Set());
        }
        const key = `${position.x},${position.y}`;
        const playerTiles = this.visitedTiles.get(playerId);
        if (playerTiles.has(key)) return false;
        playerTiles.add(key);
        return true;
    }

    toJSON(): unknown {
        return {
            players: this.players,
            leftPlayers: this.leftPlayers,
            status: this.status,
            roomId: this.roomId,
            maxPlayers: this.maxPlayers,
            mapCopy: this.mapCopy,
            host: this.host,
            mapId: this.mapId,
            socketToAvatar: Object.fromEntries(this.socketToAvatar),
            playerOrder: this.playerOrder,
            currentPlayerIndex: this.currentPlayerIndex,
            currentTurnTime: this.currentTurnTime,
            currentInterTurnTime: this.currentInterTurnTime,
            activeCombat: this.activeCombat,
            currentCombatTurnTime: this.currentCombatTurnTime,
            startingPoints: Object.fromEntries(this.startingPoints),
            isTurnStarting: this.isTurnStarting,
            isDebugModeActivated: this.isDebugModeActivated,
            gameMode: this.gameMode,
            playerTeams: Object.fromEntries(this.playerTeams),
            flagPosition: this.flagPosition,
            flagHolderId: this.flagHolderId,
        };
    }
}

export { Position };
