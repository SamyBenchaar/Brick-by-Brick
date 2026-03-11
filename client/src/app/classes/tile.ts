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
    type: TileType;
    object: ObjectType | undefined;

    constructor(type: TileType = TileType.Base) {
        this.type = type;
    }

    static getCssClass(type: TileType | ObjectType): string {
        return `tile-${type}`;
    }


} 