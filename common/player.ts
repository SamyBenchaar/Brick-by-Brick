import { Character } from './character';
import { VirtualPlayerProfile } from './virtual.player.profile';

export type Player = {
    socketId: string;
    character: Character;
    virtualProfile?: VirtualPlayerProfile;
};