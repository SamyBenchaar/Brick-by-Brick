import { Character } from "./character-model";

export interface GameSession {
    gameId: string;
    players: Character[];
}