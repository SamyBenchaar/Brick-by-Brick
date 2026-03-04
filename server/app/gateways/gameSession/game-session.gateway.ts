import { GameSessionService } from '@app/services/gameSession/gameSession.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { GameSession } from '@common/gameSession';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
    OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage,
    WebSocketGateway, WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()

export class GameSessionGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly logger: Logger,
        @Inject(forwardRef(() => GameSessionService))
        private gameSessionService: GameSessionService,
    ) {}

    afterInit() {
        this.logger.log('GameSessionGateway initialisé');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Client connecté au GameSessionGateway: ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        const sessions = this.gameSessionService.getAllGameSessions();

        for (const session of sessions) {
            const player = session.players.find(p => p.socketId === socket.id);

            if (player) {
                session.removePlayer(socket.id);

                if (session.players.length === 0) {
                    this.gameSessionService.deleteGameSession(session.roomId);
                    this.notifyGameSessionDeleted(session.roomId);
                } else {
                    this.notifyGameSessionUpdated(session);
                }
                break;
            }
        }
        this.logger.log(`Client déconnecté du GameSessionGateway: ${socket.id}`);
    }

    @SubscribeMessage(GameSessionEvents.RequestGameSessionList)
    async handleRequestAvailableGameSessionList(socket: Socket) {
        const gameSessions = await this.gameSessionService.getAvailableGameSessions();
        socket.emit(GameSessionEvents.GameSessionList, gameSessions);
    }

    @SubscribeMessage(GameSessionEvents.CreateGameSession)
    async handleCreateGameSession(socket: Socket, payload: { gameId: string, hostPlayer: Character }) {
        const { gameId, hostPlayer } = payload;

        hostPlayer.id = socket.id;
        const gameSession = this.gameSessionService.createGameSession(socket.id, hostPlayer, gameId);

        socket.emit(GameSessionEvents.GameSessionCreated, gameSession);
        this.notifyGameSessionCreated(gameSession);
    }

    @SubscribeMessage(GameSessionEvents.JoinGameSession)
    async handleJoinGameSession(socket: Socket, payload: { roomId: string, player: Character }) {
        const { roomId, player } = payload;
        const gameSession = this.gameSessionService.getGameSession(roomId);

        if (!gameSession) {
            socket.emit(GameSessionEvents.GameSessionJoinError, 'Session de jeu introuvable');
            return;
        }

        if (gameSession.status !== 'waiting') {
            socket.emit(GameSessionEvents.GameSessionJoinError, 'La session de jeu a déjà commencé');
            return;
        } else if (gameSession.players.length >= gameSession.maxPlayers) {
            socket.emit(GameSessionEvents.GameSessionFull, 'La session de jeu est pleine');
            return;
        }
        player.id = socket.id;
        gameSession.addPlayer(socket.id, player);

        // Si la session est maintenant pleine, passer le statut à 'playing'
        if (gameSession.players.length >= gameSession.maxPlayers) {
            gameSession.status = 'playing';
        }

        this.notifyGameSessionUpdated(gameSession);
    }

    @SubscribeMessage(GameSessionEvents.LeaveGameSession)
    handleLeaveGameSession(socket: Socket, payload: { roomId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) return;

        gameSession.removePlayer(socket.id);

        if (gameSession.players.length === 0) {
            this.gameSessionService.deleteGameSession(gameSession.roomId);
            this.notifyGameSessionDeleted(gameSession.roomId);
        } else {
            this.notifyGameSessionUpdated(gameSession);
        }
    }

    notifyGameSessionCreated(gameSession: GameSession): void {
        this.server.emit(GameSessionEvents.GameSessionCreated, gameSession);
    }

    notifyGameSessionUpdated(gameSession: GameSession): void {
        this.server.emit(GameSessionEvents.GameSessionUpdated, gameSession);
    }

    notifyGameSessionDeleted(gameSessionId: string): void {
        this.server.emit(GameSessionEvents.GameSessionDeleted, gameSessionId);
    }
}
