import { Character } from './character';

export class GameSession {
    
    players: {
        socketId: string;
        character: Character;
    }[] = [];
    status: string = 'waiting';
    roomId: string;
    maxPlayers: number;
    mapCopy: null;

    constructor(socketId: string, hostPlayer: Character, mapId: string ) {
        this.addPlayer(socketId, hostPlayer);
        // to do: roomId, maxplayers et mapcopy, la cest des valeurs temporaires
        if (!mapId){}
        this.roomId = 4 + Math.random().toString(16).slice(2, 6);
        this.maxPlayers = 4;
    };

    addPlayer(socketId: string, character: Character): void {
        if (this.players.length >= this.maxPlayers) {
            throw new Error('Game session is full');
        }
        this.players.push({ socketId, character });
    }

    removePlayer(socketId: string):void {
        this.players = this.players.filter(player => player.socketId !== socketId);
    }

}