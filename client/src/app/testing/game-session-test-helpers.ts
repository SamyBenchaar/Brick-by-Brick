import { GameSession } from '@app/interfaces/game-session';
import { Character } from '@common/character';

export type SessionStatus = 'waiting' | 'playing';

export const makeTestCharacter = (name = 'Player', avatarId = 1): Character => ({
    id: '',
    name,
    avatarId,
} as Character);

export const makeTestSession = (
    {
        roomId,
        status = 'waiting',
        playerCount = 1,
        maxPlayers = 4,
        hostId = 'host-1',
        playerNames,
        avatarIds,
    }: {
        roomId: string;
        status?: SessionStatus;
        playerCount?: number;
        maxPlayers?: number;
        hostId?: string;
        playerNames?: string[];
        avatarIds?: number[];
    },
): GameSession => {
    const players = Array.from({ length: playerCount }, (_, i) => {
        const socketId = i === 0 ? hostId : `p${i}`;
        const name = playerNames?.[i] ?? `Player${i}`;
        const avatarId = avatarIds?.[i] ?? (i % 6) + 1;
        return { socketId, character: makeTestCharacter(name, avatarId) };
    });

    return {
        roomId,
        status,
        maxPlayers,
        players,
        host: players[0],
    } as unknown as GameSession;
};
