import { Character } from './character';

export type SessionStatus = 'waiting' | 'playing';

export class GameSession {

    private players: Character[] = [];
    private status: SessionStatus = 'waiting';
    private roomId: string;
    private isLocked: boolean = false;
    private maxPlayers: number;

    constructor(private hostPlayer: Character, private mapId: string, maxPlayers: number) {
        this.roomId = crypto.randomUUID().substring(0, 8).toUpperCase();
        this.maxPlayers = maxPlayers;
        this.addPlayer(hostPlayer);
    }

    getRoomId(): string {
        return this.roomId;
    }

    getPlayers(): Character[] {
        return [...this.players];
    }

    getHostPlayer(): Character {
        return this.hostPlayer;
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

    isHost(characterId: string): boolean {
        return this.hostPlayer.id === characterId;
    }

    isFull(): boolean {
        return this.players.length >= this.maxPlayers;
    }

    addPlayer(character: Character): void {
        this.players.push(character);
        if (this.isFull()) this.lock();
    }

    removePlayer(characterId: string): void {
        this.players = this.players.filter(player => player.id !== characterId);
        if (!this.isFull() && this.isLocked) this.unlock();
    }

    lock(): void {
        this.isLocked = true;
    }

    unlock(): void {
        this.isLocked = false;
    }

    startGame(): void {
        this.status = 'playing';
    }
}