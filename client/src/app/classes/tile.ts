import { ObjectType, TileType } from '@common/map';

export class Tile {

    static readonly editableTypes: TileType[] =
        [
            TileType.Water,
            TileType.Ice,
            TileType.Wall,
        ];
    static readonly editableObjects: ObjectType[] =
        [
            ObjectType.Startpoint,
        ];
    private _type: TileType;
    private _object: ObjectType | undefined;

    constructor(type: TileType = TileType.Base) {
        this._type = type;
    }

    get type(): TileType {
        return this._type;
    }
    set type(type: TileType) {
        this._type = type;
    }

    get object(): ObjectType | undefined {
        return this._object;
    }
    set object(type: ObjectType | undefined) {
        this._object = type;
    }

    static getCssClass(type: TileType | ObjectType): string {
        return `tile-${type}`;
    }


} 