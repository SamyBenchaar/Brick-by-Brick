export enum TileType {
    Base = 'base',
    Water = 'water',
    Ice = 'ice',
    Wall = 'wall',
    Door = 'door',
}

export enum ObjectType {
    FLAG = 'flag',
    COMBATSANCTUARY = 'combatsanctuary',
    HEALINGSANCTUARY = 'healingsanctuary',
    STARTPOINT = 'startingpoint'
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

export enum TilesTypes {
    Base = 'base',
    Water = 'water',
    Ice = 'ice',
    Wall = 'wall',
    Door = 'door',
}

export const GRID_SIZE = 750;

// Constantes pour la validation
export const MIN_TERRAIN_COVERAGE = 0.5;

export const PERCENTAGE_MULTIPLIER = 100;

export const PLAYABLE_TYPES = [TilesTypes.Base, TilesTypes.Ice, TilesTypes.Door, TilesTypes.Water];