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

export interface CombatResult {
    winner: string;
    loser: string;
    attackerVictories: number;
    defenderKnockedDown: boolean;
    gameWon: boolean;
}

export interface CombatInfo {
    attacker: {
        id: string;
        name: string;
        avatarId: number;
        victories: number;
    };
    defender: {
        id: string;
        name: string;
        avatarId: number;
        victories: number;
    };
}

