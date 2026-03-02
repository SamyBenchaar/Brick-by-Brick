import { Character } from './character';

export class GameSession {
    
    private players: Character[] = [];
    private status: 'waiting';
    private roomId: string;
    private maxPlayers: number;
    private mapCopy: null;

    constructor(private hostPlayer: Character, private mapId: string ) {
        this.addPlayer(hostPlayer);
        // to do: roomId, maxplayers et mapcopy
    };

    addPlayer(character): void {
        this.players.push(character);
    }

    removePlayer(character):void {
        this.players = this.players.filter(player => player.getId() !== character.getId())
    }

    getRoomId(): string {
        return this.roomId;
    }

}