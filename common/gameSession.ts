import { Character } from './character';

export class GameSession {
    
    private _players: Character[] = [];
    private _status: string = 'waiting';
    private _roomId: string;
    private _maxPlayers: number;
    private _mapCopy: null;

    constructor(hostPlayer: Character, mapId: string ) {
        this.addPlayer(hostPlayer);
        // to do: roomId, maxplayers et mapcopy
        if (mapId){}
        this.roomId = 4 + Math.random().toString(16).slice(2, 6);
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

    get roomId(): string {
        return this._roomId;
    }
    get players(): Character[] {
        return this._players;
    }
    get status(): string {
        return this._status;
    }
    get maxPlayers(): number {
        return this._maxPlayers;
    }
    get mapCopy(): null {
        return this._mapCopy;
    }

    set roomId(value: string) {
        this._roomId = value;
    }
    set players(value: Character[]) {
        this._players = value;
    }
    set status(value: string) {
        this._status = value;
    }
    set maxPlayers(value: number) {
        this._maxPlayers = value;
    }
    set mapCopy(value: null) {
        this._mapCopy = value;
    }

}