export interface MapTile {
    type: string;
    object?: { type: string };
}

export interface GameMap {
    tiles: MapTile[][];
}

export interface MovementCost {
    base: number;
    water: number;
    ice: number;
}

export interface GameDataForInit {
    mapConfig: {
        tiles: MapTile[][];
    };
}

