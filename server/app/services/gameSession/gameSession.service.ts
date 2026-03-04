import { Injectable } from '@nestjs/common';
import { GameSession } from '@common/gameSession';
import { Character } from '@common/character';

@Injectable()
export class GameSessionService {

    private gameSessions: Map<string, GameSession> = new Map();

    createGameSession(socketId: string, hostPlayer: Character, mapId: string): GameSession {
        const newGameSession = new GameSession(socketId, hostPlayer, mapId);
        hostPlayer.id = socketId;
        this.gameSessions.set(newGameSession.roomId, newGameSession);

        return newGameSession;
    }

    getGameSession(roomId: string): GameSession {
        return this.gameSessions.get(roomId);
    }

    getAvailableGameSessions(): GameSession[] {
        return Array.from(this.gameSessions.values()).filter(session => session.status === 'waiting');
    }

    getAllGameSessions(): GameSession[] {
        return Array.from(this.gameSessions.values());
    }

    deleteGameSession(roomId: string): void {
        this.gameSessions.delete(roomId);
    }
}