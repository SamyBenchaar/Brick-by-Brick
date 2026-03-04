import { Character } from '@common/character';
import { GameSession } from '@common/gameSession';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GameSessionService {

    private gameSessions: Map<string, GameSession> = new Map();

    createGameSession(hostPlayer: Character, mapId: string, maxPlayers: number): GameSession {
        const newGameSession = new GameSession(hostPlayer, mapId, maxPlayers);
        this.gameSessions.set(newGameSession.getRoomId(), newGameSession);

        return newGameSession;
    }

    getGameSession(roomId): GameSession {
        return this.gameSessions.get(roomId);
    }

    deleteGameSession(roomId): void {
        this.gameSessions.delete(roomId);
    }
}