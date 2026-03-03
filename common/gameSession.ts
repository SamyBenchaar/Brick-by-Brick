import { Character } from './character';

export type GameStatus = 'waiting' | 'playing' | 'ended';
export class GameSession {

    private players: Array<{ socketId: string; character: Character }> = [];
    private playerOrder: string[] = [];
    private currentPlayerIndex: number = 0;
    private currentTurnTime: number = 30;
    private status: GameStatus = 'waiting';
    private roomId: string;
    private maxPlayers: number;
    private mapId: string;
    private mapCopy: any;
    private startingPoints: Map<string, Position> = new Map();

    constructor(hostPlayer: Character, mapId: string, maxPlayers: number = 2) {
        this.roomId = this.generateRoomId();
        this.maxPlayers = maxPlayers;
        this.mapId = mapId;
        this.addPlayer(hostPlayer);
    }

    isHost(socketId: string): boolean {
        return this.players[0]?.socketId === socketId;
    }

    isFull(): boolean {
        return this.players.length >= this.maxPlayers;
    }

    getPlayers(): Array<{ socketId: string; character: Character }> {
        return [...this.players];
    }

    getCharacters(): Character[] {
        return this.players.map(p => p.character);
    }

    private generateRoomId(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    addPlayer(character: Character): void {
        this.players.push({ socketId: character.socketId, character });
    }

    removePlayer(character: Character): void {
        this.players = this.players.filter(player => player.character.id !== character.id);
        this.playerOrder = this.playerOrder.filter(id => id !== character.id);
    }

    getRoomId(): string {
        return this.roomId;
    }

    getHostSocketId(): string {
        return this.players[0]?.socketId || '';
    }

    startGame(): void {
        this.status = 'playing';
    }

    getStatus(): GameStatus {
        return this.status;
    }

    setStatus(status: GameStatus): void {
        this.status = status;
    }

    getMaxPlayers(): number {
        return this.maxPlayers;
    }

    getMapId(): string {
        return this.mapId;
    }

    setMapCopy(mapData: any): void {
        this.mapCopy = mapData;
    }

    getMapCopy(): any {
        return this.mapCopy;
    }

    getPlayerOrder(): string[] {
        return this.playerOrder;
    }

    setPlayerOrder(order: string[]): void {
        this.playerOrder = order;
    }

    getCurrentPlayerIndex(): number {
        return this.currentPlayerIndex;
    }

    setCurrentPlayerIndex(index: number): void {
        this.currentPlayerIndex = index;
    }

    getCurrentPlayer(): Character | undefined {
        if (this.playerOrder.length === 0) return undefined;
        const currentPlayerId = this.playerOrder[this.currentPlayerIndex];
        return this.players.find(p => p.character.id === currentPlayerId)?.character;
    }

    getCurrentTurnTime(): number {
        return this.currentTurnTime;
    }

    setCurrentTurnTime(time: number): void {
        this.currentTurnTime = time;
    }

    decrementTurnTime(): void {
        if (this.currentTurnTime > 0) {
            this.currentTurnTime--;
        }
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
}

export interface Position {
    x: number;
    y: number;
}
