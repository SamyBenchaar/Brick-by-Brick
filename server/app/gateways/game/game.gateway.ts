import { Game } from '@app/model/game';
import { GameService } from '@app/services/game/game.service';
import { GameEvents } from '@common/game.events';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()

export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly logger: Logger,
        @Inject(forwardRef(() => GameService))
        private gameService: GameService,
    ) {}

    afterInit() {
        this.logger.log('GameGateway initialisé');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Client connecté au GameGateway: ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Client déconnecté du GameGateway: ${socket.id}`);
    }

    @SubscribeMessage(GameEvents.RequestGameList)
    async handleRequestGameList(socket: Socket) {
        const games = await this.gameService.findAll();
        socket.emit(GameEvents.GameList, games);
    }

    @SubscribeMessage(GameEvents.RequestVisibleGameList)
    async handleRequestVisibleGameList(socket: Socket) {
        const games = await this.gameService.findVisible();
        socket.emit(GameEvents.GameList, games);
    }

    notifyGameCreated(game: Game): void {
        this.server.emit(GameEvents.GameCreated, game);
    }

    notifyGameUpdated(game: Game): void {
        this.server.emit(GameEvents.GameUpdated, game);
    }

    notifyGameDeleted(gameId: string): void {
        this.server.emit(GameEvents.GameDeleted, gameId);
    }
}
