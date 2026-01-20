export interface MapConfig {
    size: string;
    gridSize: GridSize;
    gameMode: string;
}

export interface GridSize {
    width: number;
    height: number;
}

export interface Tile {
    type: string;
    state?: string;
}

export interface Position {
    x: number;
    y: number;
}

export interface MapObjects {
    startingPoints: Position[];
    flag?: Position;
    healSanctuaries: Position[];
    combatSanctuaries: Position[];
}

export interface Game {
    name: string;
    description: string;
    isVisible: boolean;
    mapConfig: MapConfig;
    tiles: Tile[][];
    objects: MapObjects;
    previewImage?: string;
    createdAt?: Date;
    lastModified?: Date;
    _id: string;
}