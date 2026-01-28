export enum TileType {
    Base = 'base',
    Water = 'water',
    Ice = 'ice',
    Wall = 'wall',
}

export enum ObjectType {
    FLAG = 'flag',
    COMBATSANCTUARY = 'combatsanctuary',
    HEALINGSANCTUARY = 'healingsanctuary',
    STARTPOINT = 'startpoint'
}

export enum MapSize {
    Small = 10,
    Medium = 15,
    Large = 20,
}

export const GRID_SIZE = 750;

// Mapping des tailles de carte
export const MAP_SIZES = {
    Small: 10,
    Medium: 15,
    Large: 20,
} as const;

// Constantes pour la validation
export const MIN_TERRAIN_COVERAGE = 0.5;

export const PERCENTAGE_MULTIPLIER = 100;

export const PLAYABLE_TYPES = ['base', 'ice', 'door'];