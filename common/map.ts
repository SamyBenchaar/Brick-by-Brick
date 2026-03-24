export enum TileType {
    Base = 'base',
    Water = 'water',
    Ice = 'ice',
    Wall = 'wall',
    Door = 'door',
}

export enum DoorState {
    Opened = 'opened',
    Closed = 'closed',
}

export enum ObjectType {
    StartingPoint = 'startingpoint'
}

export enum MapSize {
    Small = 10,
    Medium = 15,
    Large = 20,
}

export enum MinimumStartingPt {
    Small = 2,
    Medium = 4,
    Large = 6,
}

export const GRID_SIZE = 750;

// Constantes pour la validation
export const MIN_TERRAIN_COVERAGE = 0.5;

export const PERCENTAGE_MULTIPLIER = 100;

export const PLAYABLE_TYPES = [TileType.Base, TileType.Ice, TileType.Water];

export const TILE_COST: Partial<Record<TileType, number>> = {
  [TileType.Base]: 1,
  [TileType.Water]: 2,
  [TileType.Ice]: 0,
};