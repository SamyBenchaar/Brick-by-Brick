import { Position } from '@common/position';

export interface MapConfig {
    size: string;
    tiles: Tile[][];
}

export interface Tile {
    type: string;
    doorState?: string;
    object?: MapObject;
    isOrigin?: boolean;
    sanctuaryCooldown?: number;
    sanctuaryOrigin?: Position;
}

export interface MapObject {
    type: string;
}

export interface Game {
    _id: string;
    name: string;
    description: string;
    isVisible: boolean;
    numberOfPlayers: number;
    gameMode: string;
    mapConfig: MapConfig;
    previewImage?: string;
    createdAt?: Date;
    lastModified?: Date;
}