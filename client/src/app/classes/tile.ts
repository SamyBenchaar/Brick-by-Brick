import { TileType, ObjectType } from '@common/map';


export class Tile {

    static readonly editableTypes: TileType[] = 
    [
        TileType.Water,
        TileType.Ice,
        TileType.Wall,
    ];
    static readonly editableObjects: ObjectType[] = 
    [
        ObjectType.FLAG,
        ObjectType.HEALINGSANCTUARY,
        ObjectType.COMBATSANCTUARY,
        ObjectType.STARTPOINT,
    ];
    private _type: TileType;
    private _object: ObjectType;

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

    get object() {
        return this._object;
    }
    set object(type: ObjectType) {
        this._object = type;
    }
    
    static getCssClass(type: TileType | ObjectType): string {
        return `tile-${type}`;
    }


} 