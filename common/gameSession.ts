import { Character } from './character';

export class GameSession {
    
    players: Character[] = [];
    status: string = 'waiting';
    roomId: string;
    maxPlayers: number;
    mapCopy: null;

    constructor(hostPlayer: Character, mapId: string ) {
        this.addPlayer(hostPlayer);
        // to do: roomId, maxplayers et mapcopy
        if (mapId){}
        this.roomId = 4 + Math.random().toString(16).slice(2, 6);
        this.maxPlayers = 4;
    };

    addPlayer(character: Character): void {
        if (this.players.length >= this.maxPlayers) {
            throw new Error('Game session is full');
        }
        this.players.push(character);
    }

    removePlayer(character: Character):void {
        this.players = this.players.filter(player => player.id !== character.id);
    }

}