import {  TileType } from '@common/map';


export const TILE_TYPE_DESCRIPTIONS: Record<TileType, string> = {
    [TileType.Base]: 'Base',
    [TileType.Water]: 'Eau',
    [TileType.Ice]: 'Glace',
    [TileType.Door]: 'Porte',
    [TileType.Wall]: 'Mur',
};