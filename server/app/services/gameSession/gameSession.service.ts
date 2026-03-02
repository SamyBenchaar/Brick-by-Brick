import { Injectable } from '@nestjs/common';
import { GameSession } from '@common/gameSession';
import { Character } from '@common/character';

@Injectable()
export class GameSessionService {

    private gameSessions: Map<string, GameSession> = new Map();

    createGameSession(hostPlayer: Character, mapId: string ): GameSession {
        const newGameSession = new GameSession(hostPlayer, mapId);
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