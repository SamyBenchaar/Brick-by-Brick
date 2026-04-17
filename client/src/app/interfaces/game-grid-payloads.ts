import { Tile } from '@app/classes/tile/tile';
import { Position } from '@common/position';

export interface FlagDisplayContext {
    gameMode: string;
    flagPosition: Position | null;
    flagHolderId: string | null;
}

export interface ObjectPlacementContext {
    getTile: (pos: Position) => Tile | null;
    isTileObjectFree: (tile: Tile) => boolean;
}