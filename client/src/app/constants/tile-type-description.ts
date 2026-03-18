import {  TileType } from '@common/map';


export const TILE_TYPE_DESCRIPTIONS: Record<TileType, string> = {
    [TileType.Base]: 'Base',
    [TileType.Water]: 'Eau',
    [TileType.Ice]: 'Glace',
    [TileType.Door]: 'Porte',
    [TileType.Wall]: 'Mur',
};

export const TILE_COST: Partial<Record<TileType, number>> = {
  [TileType.Base]: 1,
  [TileType.Water]: 2,
  [TileType.Ice]: 0,
};