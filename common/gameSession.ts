import { Character } from './character';
// import { OnInit } from '@angular/core';

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
    // to do: roomId, maxplayers et mapcopy, la cest des valeurs temporaires
    // if (!mapId) {}
    // this.roomId = 4 + Math.random().toString(16).slice(2, 6);

    constructor(socketId: string, hostPlayer: Character, mapId: string) {
        this.host = { socketId, character: hostPlayer };
        this.roomId = crypto.randomUUID().substring(0, 8).toUpperCase();
        this.maxPlayers = 4;
        this.mapId = mapId;
        this.addPlayer(socketId, hostPlayer);
    }


    addPlayer(socketId: string, character: Character): void {
        // if (this.players.length >= this.maxPlayers) {
        //     throw new Error('Game session is full');
        // }
        const nouvelleListe = [...this.players, { socketId, character }];
        this.players = nouvelleListe.sort((a, b) => b.character.speed - a.character.speed);
    }

    removePlayer(socketId: string): void {
        if (this.status === 'waiting') {
            // Salle d'attente : suppression définitive
            this.players = this.players.filter(p => p.socketId !== socketId);
        } else {
            // En partie : déplacer dans leftPlayers pour l'affichage grisé sur le board
            const index = this.players.findIndex(p => p.socketId === socketId);
            if (index !== -1) {
                const [player] = this.players.splice(index, 1);
                this.leftPlayers.push(player);
            }
        }
    }

    isHost(socketId: string): boolean {
        return this.host.socketId === socketId;
    }

    isFull(): boolean {
        return this.players.length >= this.maxPlayers;
    }

    get activePlayers(): Player[] {
        return this.players;
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
        return this.host?.socketId || '';
    }



    // getPlayers(): Character[] {
    //     return [...this.players];
    // }

    // getHostPlayer(): Character {
    //     return this.hostPlayer;
    // }

    // getStatus(): SessionStatus {
    //     return this.status;
    // }

    // getMaxPlayers(): number {
    //     return this.maxPlayers;
    // }

    // getMapId(): string {
    //     return this.mapId;
    // }

    // getLocked(): boolean {
    //     return this.isLocked;
    // }

    // addPlayer(character: Character): void {
    //     this.players.push(character);
    //     if (this.isFull()) this.lock();
    // }

    // removePlayer(characterId: string): void {
    //     this.players = this.players.filter(player => player.id !== characterId);
    //     if (!this.isFull() && this.isLocked) this.unlock();
    // }

    // lock(): void {
    //     this.isLocked = true;
    // }

    // unlock(): void {
    //     this.isLocked = false;
    // }

    startGame(): void {
        this.status = 'playing';
    }
}
