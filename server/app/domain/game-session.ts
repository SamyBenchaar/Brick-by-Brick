import { Character } from '@common/character';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { SessionStatus } from '@common/session.status';
import { GameMap } from '@app/interfaces/game-map-interfaces';
import { ROOM_ID_LENGTH, MAX_PLAYER } from '@common/constants/game-config-constants';


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

    playerOrder: string[] = [];
    currentPlayerIndex: number = 0;
    currentTurnTime: number = 30;
    currentInterTurnTime: number = 3;
    startingPoints: Map<string, Position> = new Map();
    isTurnStarting: boolean = false;
    isDebugModeActivated = false;

    constructor(hostplayer: Player, mapId: string) {
        this.host = hostplayer;
        this.roomId = crypto.randomUUID().substring(0, ROOM_ID_LENGTH).toUpperCase();
        this.maxPlayers = MAX_PLAYER;
        this.mapId = mapId;
        this.addPlayer(hostplayer);
    }

    addPlayer(player: Player): void {
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

    advanceToNextPlayer(): void {
        this.currentPlayerIndex = this.getNextPlayerIndex();
        this.currentTurnTime = 30;
    }

    setStatus(status: SessionStatus): void {
        this.status = status;
    }
}

export { Position };
