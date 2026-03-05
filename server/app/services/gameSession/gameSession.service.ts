import { Character } from '@common/character';
import { GameSession } from '@common/gameSession';
import { Injectable } from '@nestjs/common';
import { GameService } from '@app/services/game/game.service';
import { Game } from '@app/model/game';

@Injectable()
export class GameSessionService {

    private gameSessions: Map<string, GameSession> = new Map();

    constructor(private gameService: GameService) {}
    async createGameSession(socketId: string, hostPlayer: Character, mapId: string): Promise<GameSession> {
        const originalGame = await this.gameService.findOne(mapId);
        const mapCopy = JSON.parse(JSON.stringify(originalGame));

        const newGameSession = new GameSession(socketId, hostPlayer, mapId);
        newGameSession.mapCopy = mapCopy;

        hostPlayer.id = socketId;
        this.gameSessions.set(newGameSession.roomId, newGameSession);

        return newGameSession;
    }

    getGameSession(roomId: string): GameSession {
        return this.gameSessions.get(roomId);
    }

    getAvailableGameSessions(): GameSession[] {
        return Array.from(this.gameSessions.values()).filter(session =>
            session.status === 'waiting' && session.players.length < session.maxPlayers);
    }

    getMapCopy(roomId: string): Game | null {
        const session = this.getGameSession(roomId);
        return session?.mapCopy || null;
    }
    
    getAllGameSessions(): GameSession[] {
        return Array.from(this.gameSessions.values());
    }

    deleteGameSession(roomId: string): void {
        this.gameSessions.delete(roomId);
    }

}