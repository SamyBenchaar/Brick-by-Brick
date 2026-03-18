import { GameSession } from '@app/domain/game-session';
import { Character } from '@common/character';
import { Dice } from '@common/dice';
import { Player } from '@common/player';
import { SessionStatus } from '@common/session.status';
import { Socket } from 'socket.io';

const DEFAULT_MAX_PLAYERS = 4;

export const createTestCharacter = (name = 'TestPlayer'): Character => ({
    id: '',
    name,
    avatarId: 1,
    maxLife: 6,
    life: 6,
    speed: 6,
    attack: 4,
    defense: 4,
    movements: 6,
    actions: 1,
    attackDice: Dice.D4,
    defenseDice: Dice.D6,
    isActif: false,
    battlesWon: 0,
});

export const createTestSocket = (id: string): Socket => ({
    id,
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
}) as unknown as Socket;

export const createMockSession = (
    roomId: string,
    hostId: string,
    playerCount = 1,
    options?: { status?: SessionStatus; maxPlayers?: number; mapId?: string; includeStartGameSpy?: boolean },
): GameSession => {
    const { status = SessionStatus.Waiting, maxPlayers = DEFAULT_MAX_PLAYERS, mapId = 'MAP1', includeStartGameSpy = true } = options || {};

    const session = {
        roomId,
        status,
        maxPlayers,
        mapId,
        players: [] as Player[],
        host: { socketId: hostId, character: createTestCharacter('Host') },
        mapCopy: null,
        socketToAvatar: new Map<string, number>(),
        isHost: jest.fn((id: string) => id === hostId),
        isFull: jest.fn(() => session.players.length >= session.maxPlayers),
        getTakenAvatars: jest.fn(() => Array.from(session.socketToAvatar.values())),
        addPlayer: jest.fn(),
        removePlayer: jest.fn((id: string) => {
            session.players = session.players.filter((p: Player) => p.socketId !== id);
        }),
    } as unknown as GameSession;

    if (includeStartGameSpy) {
        (session as unknown as { startGame: jest.Mock }).startGame = jest.fn(() => {
            (session as { status: SessionStatus }).status = SessionStatus.Playing;
        });
    }

    for (let i = 0; i < playerCount; i++) {
        session.players.push({ socketId: i === 0 ? hostId : `player-${i}`, character: createTestCharacter(`P${i}`) });
    }

    return session;
};
