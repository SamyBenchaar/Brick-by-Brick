import { GameSession, Player } from '@common/game-session';
import { Injectable } from '@nestjs/common';
import { GameService } from '@app/services/game/game.service';
import { getGameSizeConfig } from '@common/constants/game-config-constants';

@Injectable()
export class GameSessionService {

    private gameSessions: Map<string, GameSession> = new Map();

    constructor(private gameService: GameService) {}
    async createGameSession(hostPlayer: Player, mapId: string): Promise<GameSession> {
        const originalGame = await this.gameService.findOne(mapId);
        const mapCopy = JSON.parse(JSON.stringify(originalGame));

        const newGameSession = new GameSession(hostPlayer, mapId);
        newGameSession.mapCopy = mapCopy;
        newGameSession.maxPlayers = getGameSizeConfig(mapCopy.mapConfig.size).maxPlayers;

        this.gameSessions.set(newGameSession.roomId, newGameSession);
        return newGameSession;
    }

    joinSession(roomId: string, player: Player): string | null {
        const session = this.gameSessions.get(roomId);
        player.character.name = session.verifyUniqueName(player.character.name);

        if (!session) return 'Session de jeu introuvable';
        if (session.status !== 'waiting') return 'La session de jeu a déjà commencé';
        if (session.isFull()) return 'La session de jeu est pleine';
        session.addPlayer(player);
        return null;
    }

    kickPlayer(roomId: string, targetSocketId: string): void {
        const session = this.gameSessions.get(roomId);
        if (session) session.removePlayer(targetSocketId);
    }

    getGameSession(roomId: string): GameSession {
        return this.gameSessions.get(roomId);
    }

    getAvailableGameSessions(): GameSession[] {
        return Array.from(this.gameSessions.values()).filter(session =>
            session.status === 'waiting' && session.players.length < session.maxPlayers);
    }


    getAllGameSessions(): GameSession[] {
        return Array.from(this.gameSessions.values());
    }

    deleteGameSession(roomId: string): void {
        this.gameSessions.delete(roomId);
    }

}