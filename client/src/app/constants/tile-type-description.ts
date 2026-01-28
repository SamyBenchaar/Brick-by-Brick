import {  TileType } from '@common/map';


export const TILE_TYPE_DESCRIPTIONS: Record<TileType, string> = {
    [TileType.Base]: 'base',
    [TileType.Water]: 'water',
    [TileType.Ice]: 'ice',
    [TileType.Door]: 'door',
    [TileType.Wall]: 'wall',
};