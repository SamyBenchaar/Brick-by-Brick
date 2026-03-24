import { ObjectType, TileType, DoorState } from '@common/map';

export class Tile {

    static readonly editableTypes: TileType[] =
        [
            TileType.Water,
            TileType.Ice,
            TileType.Wall,
            TileType.Door,
        ];
    static readonly editableObjects: ObjectType[] =
        [
            ObjectType.StartingPoint,
        ];
    type: TileType;
    object: ObjectType | undefined;
    doorState?: DoorState;

    constructor(type: TileType = TileType.Base) {
        this.type = type;
    }

    static getCssClass(type: TileType | ObjectType): string {
        return `tile-${type}`;
    }


} 