import { GameSession } from '@app/interfaces/game-session';
import { Character } from '@common/character';

export const MAX_PLAYERS = 4;

export const mockPlayer = {
    socketId: 'socket1',
    character: {
        name: 'Player',
        avatarId: 1,
        speed: 5,
    } as unknown as Character,
};

export const mockPlayer2 = {
    socketId: 'socket2',
    character: {
        name: 'Player',
        avatarId: 2,
        speed: 4,
    } as unknown as Character,
};

export const mockGameSession: GameSession = {
    players: [],
    leftPlayers: [],
    status: 'waiting',
    roomId: 'room1',
    maxPlayers: MAX_PLAYERS,
    mapId: 'map1',
    mapCopy: null,
    host: mockPlayer,
    takenAvatars: [],
} as unknown as GameSession;

export const mockGameSession2: GameSession = {
    players: [],
    leftPlayers: [],
    status: 'waiting',
    roomId: 'room2',
    maxPlayers: MAX_PLAYERS,
    mapId: 'map1',
    mapCopy: null,
    host: mockPlayer2,
    takenAvatars: [],
} as unknown as GameSession;
