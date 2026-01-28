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
    STARTPOINT = 'startpoint'
}

export enum MapSize {
    Small = 'Small',
    Medium = 'Medium',
    Large = 'Large',
}

export const GRID_SIZE = 750;

// Mapping des tailles de carte
export const MAP_SIZE_DIMENSIONS = {
    'Small': 10,
    'Medium': 15,
    'Large': 20,
} as const;

export const MAP_SIZES = {
    Small: 10,
    Medium: 15,
    Large: 20,
} as const;

// Constantes pour la validation
export const MIN_TERRAIN_COVERAGE = 0.5;

export const PERCENTAGE_MULTIPLIER = 100;

export const PLAYABLE_TYPES = ['base', 'ice', 'door'];