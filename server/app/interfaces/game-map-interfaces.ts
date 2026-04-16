import { Position } from '@common/position';

export interface TileObjectRef {
    type: string;
}

export interface GameMapConfig<TTile> {
    tiles: TTile[][];
}

export interface MapTile {
    type: string;
    object?: TileObjectRef;
    doorState?: string;
    isOrigin?: boolean;
    sanctuaryOrigin?: Position;
    sanctuaryCooldown?: number;
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
    mapConfig: GameMapConfig<MapTile>;
}

export interface CombatResult {
    winner: string;
    loser: string;
    attackerVictories: number;
    defenderKnockedDown: boolean;
    gameWon: boolean;
}

export interface CombatParticipant {
    id: string;
    name: string;
    avatarId: number;
    victories: number;
}

export interface CombatInfo {
    attacker: CombatParticipant;
    defender: CombatParticipant;
}

