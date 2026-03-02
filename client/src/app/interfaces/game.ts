import { Character } from '@common/character';

export interface MapConfig {
    size: string;
    tiles: Tile[][];
}

export interface Tile {
    type: string;
    state?: string;
    object?: MapObject;
    character: null | &Character;
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