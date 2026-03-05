import { Character } from './character';

export type SessionStatus = 'waiting' | 'playing';

export class GameSession {
    players: { socketId: string; character: Character }[] = [];
    status: SessionStatus = 'waiting';
    roomId: string;
    maxPlayers: number;
    mapId: string;
    isLocked: boolean = false;

    constructor(socketId: string, hostPlayer: Character, mapId: string) {
        this.roomId = crypto.randomUUID().substring(0, 8).toUpperCase();
        this.maxPlayers = 4;
        this.mapId = mapId;
        this.addPlayer(socketId, hostPlayer);
    }

    addPlayer(socketId: string, character: Character): void {
        this.players.push({ socketId, character });
        if (this.isFull()) this.lock();
    }

    removePlayer(socketId: string): void {
        this.players = this.players.filter(p => p.socketId !== socketId);
        if (!this.isFull() && this.isLocked) this.unlock();
    }

    isHost(socketId: string): boolean {
        return this.players[0]?.socketId === socketId;
    }

    isFull(): boolean {
        return this.players.length >= this.maxPlayers;
    }

    lock(): void {
        this.isLocked = true;
    }

    unlock(): void {
        this.isLocked = false;
    }

    getPlayers(): { socketId: string; character: Character }[] {
        return [...this.players];
    }

    getStatus(): SessionStatus {
        return this.status;
    }

    getMaxPlayers(): number {
        return this.maxPlayers;
    }

    getMapId(): string {
        return this.mapId;
    }

    getLocked(): boolean {
        return this.isLocked;
    }

    getRoomId(): string {
        return this.roomId;
    }

    startGame(): void {
        this.status = 'playing';
    }
}

