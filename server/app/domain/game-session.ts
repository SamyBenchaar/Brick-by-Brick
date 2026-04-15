import { GameMap } from '@app/interfaces/game-map-interfaces';
import { Character } from '@common/character';
import { ActiveCombat } from '@common/combat';
import { COMBAT_TURN_TIME } from '@common/constants/combat-constants';
import { MAX_PLAYER, ROOM_ID_LENGTH } from '@common/constants/game-config-constants';
import { SHUFFLE_FACTOR } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { SessionStatus } from '@common/session.status';


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
    playerTeams: Map<string, 'team1' | 'team2'> = new Map();
    flagPosition: Position | null = null;
    flagHolderId: string | null = null;
    flagTransferRequests: Map<string, { from: string; to: string; timestamp: number }> = new Map();

    constructor(hostplayer: Player, mapId: string, gameMode: string = 'classic') {
        this.host = hostplayer;
        this.roomId = crypto.randomUUID().substring(0, ROOM_ID_LENGTH).toUpperCase();
        this.maxPlayers = MAX_PLAYER;
        this.mapId = mapId;
        this.gameMode = gameMode;
        this.addPlayer(hostplayer);
    }

    addPlayer(player: Player): void {
        this.players = this.players.filter(p => p.socketId !== player.socketId);
        if(this.status === SessionStatus.Waiting) {
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

        if (this.flagHolderId === removedPlayer.character.id && this.gameMode === 'ctf') {
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
        return this.players.map(p => p.character);
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
        return this.players.find(p => p.character.id === currentPlayerId)?.character;
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
        return this.players.filter(p => this.playerOrder.includes(p.character.id)).map(p => p.character);
    }

    getNextPlayerIndex(): number {
        return (this.currentPlayerIndex + 1) % this.playerOrder.length;
    }

    getCharacterById(id: string): Character | undefined {
        return this.players.find(p => p.character.id === id)?.character;
    }

    advanceToNextPlayer(): void {
        this.currentPlayerIndex = this.getNextPlayerIndex();
        this.currentTurnTime = 30;
    }

    setStatus(status: SessionStatus): void {
        this.status = status;
    }

    assignTeams(): void {
        if (this.gameMode !== 'ctf' || this.players.length % 2 !== 0) {
            return;
        }

        const shuffledPlayers = [...this.players].sort(() => Math.random() - SHUFFLE_FACTOR);
        const midpoint = shuffledPlayers.length / 2;

        shuffledPlayers.slice(0, midpoint).forEach(p => {
            this.playerTeams.set(p.character.id, 'team1');
            p.character.team = 'team1';
        });

        shuffledPlayers.slice(midpoint).forEach(p => {
            this.playerTeams.set(p.character.id, 'team2');
            p.character.team = 'team2';
        });
    }

    getPlayerTeam(playerId: string): 'team1' | 'team2' | undefined {
        return this.playerTeams.get(playerId);
    }

    getTeammates(playerId: string): Character[] {
        const playerTeam = this.playerTeams.get(playerId);
        if (!playerTeam) return [];

        return this.players
            .filter(p => this.playerTeams.get(p.character.id) === playerTeam && p.character.id !== playerId)
            .map(p => p.character);
    }

    getTotalPlayersInTeam(team: 'team1' | 'team2'): number {
        return this.players.filter(p => this.playerTeams.get(p.character.id) === team).length;
    }

    getTeamPlayers(team: 'team1' | 'team2'): Character[] {
        return this.players
            .filter(p => this.playerTeams.get(p.character.id) === team)
            .map(p => p.character);
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
        }
        this.flagHolderId = playerId;
        this.players.forEach(p => {
            p.character.hasFlag = p.character.id === playerId;
        });
    }

    getFlagHolder(): string | null {
        return this.flagHolderId;
    }

    getFlagHolderCharacter(): Character | undefined {
        if (!this.flagHolderId) return undefined;
        return this.players.find(p => p.character.id === this.flagHolderId)?.character;
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

    getFlagTransferRequest(playerId: string): { from: string; to: string; timestamp: number } | undefined {
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
