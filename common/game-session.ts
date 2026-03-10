import { Character } from './character';

export type SessionStatus = 'waiting' | 'playing';

export type Player = {
    socketId: string;
    character: Character;
};

export class GameSession {
    players: Player[] = [];
    leftPlayers: Player[] = [];
    status: SessionStatus = 'waiting';
    roomId: string;
    maxPlayers: number;
    mapCopy: null;
    host: Player;
    mapId: string;
    takenAvatars: number[] = [];

    constructor(hostplayer: Player, mapId: string) {
        this.host = hostplayer;
        this.roomId = crypto.randomUUID().substring(0, 8).toUpperCase();
        this.maxPlayers = 4;
        this.mapId = mapId;
        this.addPlayer(hostplayer);
    }


    addPlayer(player: Player): void {
        // if (this.players.length >= this.maxPlayers) {
        //     throw new Error('Game session is full');
        // }
        const nouvelleListe = [...this.players, player];
        this.players = nouvelleListe.sort((a, b) => b.character.speed - a.character.speed);
        this.takenAvatars.push(player.character.avatarId);
    }

    removePlayer(socketId: string): void {
        if (this.status === 'waiting') {
            // Salle d'attente : suppression définitive
            this.players = this.players.filter(p => p.socketId !== socketId);
        } else {
            // En partie : déplacer dans leftPlayers pour l'affichage grisé sur le board
            const player = this.players.find(player => player.socketId === socketId);
            if(!player) return;
            this.takenAvatars = this.takenAvatars.filter(
                avatarId => avatarId !== player.character.avatarId
            );
            
            const index = this.players.findIndex(p => p.socketId === socketId);
            if (index !== -1) {
                const [player] = this.players.splice(index, 1);
                this.leftPlayers.push(player);
            }
        }
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
        return this.host.socketId === socketId;
    }

    isFull(): boolean {
        return this.players.length >= this.maxPlayers;
    }

    gethost(): Player {
        return this.host;
    }

    get activePlayers(): Player[] {
        return this.players;
    }

    getPlayers(): Player[] {
        return [...this.players];
    }

    getLeftPlayers(): Player[] {
        return [...this.leftPlayers];
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
        return this.host?.socketId || '';
    }

    startGame(): void {
        this.status = 'playing';
    }
}
