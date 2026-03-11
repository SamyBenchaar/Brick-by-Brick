import { Character } from './character';

export type Player = {
    socketId: string;
    character: Character;
};