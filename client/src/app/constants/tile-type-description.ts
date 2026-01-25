import {  TileType } from '@common/map';


export const TILE_TYPE_DESCRIPTIONS: Record<TileType, string> = {
    [TileType.Base]: 'base',
    [TileType.Water]: 'eau',
    [TileType.Ice]: 'glace',
    [TileType.Wall]: 'mur',
};