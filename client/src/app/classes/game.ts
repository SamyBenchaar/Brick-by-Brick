import { GameMap } from './game-map';


export class Game {
    private _name: string;
    private _description: string;
    private _map: GameMap;

    constructor(name: string, description: string, map: GameMap) {
        this._name = name;
        this._description = description;
        this._map = map;
    }

    get name(): string {
        return this._name;
    }
    get description(): string {
        return this._description;
    }
    get map(): GameMap {
        return this._map;
    }

    set name(name: string) {
        this._name = name;
    }
    
    set description(description: string) {
        this._description = description;
    }

    set map(map: GameMap) {
        this._map = map;
    }
}
