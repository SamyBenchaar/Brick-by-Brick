import { Injectable } from '@nestjs/common';
import { GameSession } from '@common/gameSession';
import { Character } from '@common/character';

@Injectable()
export class GameSessionService {

    private gameSessions: Map<string, GameSession> = new Map();

    onModuleInit() {
        // this.seedGameSessions();
    }

    createGameSession(hostPlayer: Character, mapId: string ): GameSession {
        const newGameSession = new GameSession(hostPlayer, mapId);
        this.gameSessions.set(newGameSession.roomId, newGameSession);

        return newGameSession;
    }

    getGameSession(roomId): GameSession {
        return this.gameSessions.get(roomId);
    }

    getAvailableGameSessions(): GameSession[] {
        return Array.from(this.gameSessions.values()).filter(session => session.status === 'waiting');
    }

    deleteGameSession(roomId: string): void {
        this.gameSessions.delete(roomId);
    }

    seedGameSessions() {
        const host1 = new Character('Alice', 1, 100, 5, 10, 8, null, null);
        const host2 = new Character('Bob', 2, 100, 5, 10, 8, null, null);

        this.createGameSession(host1, 'map01');
        this.createGameSession(host2, 'map02');
    }
}