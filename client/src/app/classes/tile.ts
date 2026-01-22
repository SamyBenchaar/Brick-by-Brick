import { TileType} from '@common/map';


export class Tile {

    static readonly editableTypes: TileType[] = 
    [
        TileType.Water,
        TileType.Ice,
        TileType.Wall,
    ];
    private _type: TileType;

    private readonly _x: number;
    private readonly _y: number;
    constructor(type: TileType, x: number, y: number) {
        this._x = x;
        this._y = y;
        this._type = type;
    }

    get x(): number {
        return this._x;
    }
    get y(): number {
        return this._y;
    }

    get type(): TileType {
        return this._type;
    }
    set type(type: TileType) {
        this._type = type;
    }
    
    static getCssClass(type: TileType): string {
        return `tile-${type}`;
    }


} 