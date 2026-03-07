import { Character } from './character';

export type SessionStatus = 'waiting' | 'playing';

export class GameSession {
    players: { socketId: string; character: Character }[] = [];
    status: SessionStatus = 'waiting';
    roomId: string;
    maxPlayers: number;
    mapId: string;
    takenAvatars: number[] = [];

    constructor(socketId: string, hostPlayer: Character, mapId: string) {
        this.roomId = crypto.randomUUID().substring(0, 8).toUpperCase();
        this.maxPlayers = 4;
        this.mapId = mapId;
        this.addPlayer(socketId, hostPlayer);
    }

    addPlayer(socketId: string, character: Character): void {
        this.players.push({ socketId, character });
        this.takenAvatars.push(character.avatarId);
    }

    removePlayer(socketId: string): void {
        const player = this.players.find(player => player.socketId === socketId);
        this.takenAvatars = this.takenAvatars.filter(id => id !== player?.character.avatarId);
        this.players = this.players.filter(p => p.socketId !== socketId);
    }

    verifyUniqueName(name: string): string {
        let nameToVerify = name;
        let counter = 2;

        while(!this.isNameUnique(nameToVerify)) {
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
        return this.players[0]?.socketId === socketId;
    }

    isFull(): boolean {
        return this.players.length >= this.maxPlayers;
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

    getRoomId(): string {
        return this.roomId;
    }

    getHostSocketId(): string {
        return this.players[0]?.socketId || '';
    }

    startGame(): void {
        this.status = 'playing';
    }
}

