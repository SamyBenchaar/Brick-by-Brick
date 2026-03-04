import { Character } from './character';
// import { OnInit } from '@angular/core';

export type SessionStatus = 'waiting' | 'playing';

export class GameSession {

    players: {
        socketId: string;
        character: Character;
    }[] = [];
    status: string = 'waiting';
    roomId: string;
    maxPlayers: number;
    mapCopy: null;
    host: Character;

    constructor(socketId: string, hostPlayer: Character, mapId: string) {
        this.host = hostPlayer;
        this.addPlayer(socketId, hostPlayer);
        // to do: roomId, maxplayers et mapcopy, la cest des valeurs temporaires
        if (!mapId) {}
        this.roomId = 4 + Math.random().toString(16).slice(2, 6);
        this.maxPlayers = 4;
    };


    addPlayer(socketId: string, character: Character): void {
        // if (this.players.length >= this.maxPlayers) {
        //     throw new Error('Game session is full');
        // }
        const nouvelleListe = [...this.players, { socketId, character }];
        this.players = nouvelleListe.sort((a, b) => b.character.speed - a.character.speed);
    }

    getRoomId(): string {
        return this.roomId;
    }

    getHostSocketId(): string {
        return this.players[0]?.socketId || '';
    }

    removePlayer(socketId: string): void {
        this.players = this.players.filter(player => player.socketId !== socketId);
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

    isHost(characterId: string): boolean {
        return this.host.id === characterId;
    }

    isFull(): boolean {
        return this.players.length >= this.maxPlayers;
    }

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