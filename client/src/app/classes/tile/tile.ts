import { DoorState, ObjectType, TileType } from '@common/map';
import { Position } from '@common/position';

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
            ObjectType.HealingSanctuary,
            ObjectType.CombatSanctuary,
        ];
    type: TileType;
    object: ObjectType | undefined;
    doorState?: DoorState;
    sanctuaryOrigin?: Position;

    constructor(type: TileType = TileType.Base) {
        this.type = type;
    }

    static getCssClass(type: TileType | ObjectType): string {
        return `tile-${type}`;
    }


} 