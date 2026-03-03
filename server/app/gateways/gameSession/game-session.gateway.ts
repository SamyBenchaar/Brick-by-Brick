import { GameSession } from '@common/gameSession';
import { Character } from '@common/character';
import { GameSessionService } from '@app/services/gameSession/gameSession.service';
import { GameSessionEvents } from '@common/game.events';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, 
    WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
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

        const gameSession = this.gameSessionService.createGameSession(hostPlayer, gameId);

        socket.emit(GameSessionEvents.GameSessionCreated, gameSession);
        this.notifyGameSessionCreated(gameSession);
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
