import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GameSessionService } from '@app/services/gameSession/gameSession.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { GameSession } from '@common/gameSession';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
    OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage,
    WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()

export class GameSessionGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;

    private socketToRoom: Map<string, string> = new Map(); // suit quelle socket est dans quelle salle, évite de faire une for loop

    constructor(
        private readonly logger: Logger,
        @Inject(forwardRef(() => GameSessionService))
        private gameSessionService: GameSessionService,
        @Inject(forwardRef(() => ChatGateway))
        private chatGateway: ChatGateway,
    ) {}

    afterInit() {
        this.logger.log('GameSessionGateway initialisé');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Client connecté au GameSessionGateway: ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Client déconnecté du GameSessionGateway: ${socket.id}`);
        const roomId = this.socketToRoom.get(socket.id);
        if (roomId) this.handleLeaveLogic(socket, roomId);
    }

    @SubscribeMessage(GameSessionEvents.RequestGameSessionList)
    handleRequestAvailableGameSessionList(socket: Socket) {
        const gameSessions = this.gameSessionService.getAvailableGameSessions();
        socket.emit(GameSessionEvents.GameSessionList, gameSessions);
    }

    @SubscribeMessage(GameSessionEvents.CreateGameSession)
    async handleCreateGameSession(socket: Socket, payload: { gameId: string; hostPlayer: Character }) {
        const { gameId, hostPlayer } = payload;
        hostPlayer.id = socket.id;
        const gameSession = await this.gameSessionService.createGameSession(socket.id, hostPlayer, gameId);

        socket.join(gameSession.roomId);
        this.socketToRoom.set(socket.id, gameSession.roomId);

        this.notifyGameSessionCreated(gameSession);
        this.logger.log(`Salle créée : ${gameSession.roomId} par ${socket.id}`);
    }

    @SubscribeMessage(GameSessionEvents.JoinGameSession)
    handleJoinGameSession(socket: Socket, payload: { roomId: string; player: Character }) {
        const { roomId, player } = payload;
        player.id = socket.id;

        const error = this.gameSessionService.joinSession(roomId, socket.id, player);

        if (error) {
            socket.emit(GameSessionEvents.GameSessionJoinError, error);
            return;
        }

        const gameSession = this.gameSessionService.getGameSession(roomId);
        if (!gameSession) return;

        socket.join(roomId);
        this.socketToRoom.set(socket.id, roomId);

        this.server.to(roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);

        const updatedAvailable = this.gameSessionService.getAvailableGameSessions();
        this.server.emit(GameSessionEvents.GameSessionListUpdated, updatedAvailable);

        this.logger.log(`Joueur ${socket.id} a rejoint la salle ${roomId}`);
    }

    @SubscribeMessage(GameSessionEvents.StartGame)
    handleStartGame(socket: Socket, payload: { roomId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);

        if (!gameSession) {
            socket.emit(GameSessionEvents.GameSessionJoinError, 'Session introuvable');
            return;
        }
        if (!gameSession.isHost(socket.id)) {
            socket.emit(GameSessionEvents.GameSessionJoinError, "Seul l'organisateur peut démarrer la partie");
            return;
        }
        if (gameSession.players.length < 2) {
            socket.emit(GameSessionEvents.GameSessionJoinError, 'Il faut au moins 2 joueurs pour démarrer');
            return;
        }

        gameSession.startGame();
        this.server.to(payload.roomId).emit(GameSessionEvents.GameStarted, {
             roomId: payload.roomId,
             mapData: gameSession.mapCopy,
            gameSession,
         });
        this.logger.log(`Partie démarrée dans la salle ${payload.roomId}`);
    }

    @SubscribeMessage(GameSessionEvents.LeaveGameSession)
    handleLeaveGameSession(socket: Socket, payload: { roomId: string }) {
        this.handleLeaveLogic(socket, payload.roomId);
    }

    @SubscribeMessage(GameSessionEvents.KickPlayer)
    handleKickPlayer(socket: Socket, payload: { roomId: string; targetId: string }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);

        if (!gameSession) {
            socket.emit(GameSessionEvents.GameSessionJoinError, 'Session introuvable');
            return;
        }
        if (!gameSession.isHost(socket.id)) {
            socket.emit(GameSessionEvents.GameSessionJoinError, "Seul l'organisateur peut exclure un joueur");
            return;
        }

        this.gameSessionService.kickPlayer(payload.roomId, payload.targetId);
        this.socketToRoom.delete(payload.targetId);

        this.server.to(payload.targetId).emit(GameSessionEvents.PlayerKicked, {
            message: "Vous avez été exclu de la salle d'attente.",
        });

        const targetSocket = this.server.sockets.sockets.get(payload.targetId);
        if (targetSocket) targetSocket.leave(payload.roomId);

        const updatedSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!updatedSession) return;

        this.server.emit(GameSessionEvents.GameSessionUpdated, updatedSession);

        this.logger.log(`Joueur ${payload.targetId} exclu de la salle ${payload.roomId}`);
    }

    private handleLeaveLogic(socket: Socket, roomId: string) {
        const gameSession = this.gameSessionService.getGameSession(roomId);
        if (!gameSession) return;

        this.socketToRoom.delete(socket.id);
        socket.leave(roomId);

        if (gameSession.isHost(socket.id)) {
            this.server.to(roomId).emit(GameSessionEvents.RoomCancelled, {
                message: "L'organisateur a quitté la salle. La partie est annulée.",
            });
            this.gameSessionService.deleteGameSession(roomId);
            this.chatGateway.clearChatHistoryForRoom(roomId);
            this.notifyGameSessionDeleted(roomId);
            this.logger.log(`Salle ${roomId} annulée (orga déconnecté)`);
        } else {
            gameSession.removePlayer(socket.id);
            
            // Si la salle est vide après le départ du joueur, la supprimer complètement
            if (gameSession.players.length === 0) {
                this.gameSessionService.deleteGameSession(roomId);
                this.chatGateway.clearChatHistoryForRoom(roomId);
                this.notifyGameSessionDeleted(roomId);
                this.logger.log(`Salle ${roomId} supprimée (vide)`);
            } else {
                this.server.to(roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
                const updatedAvailable = this.gameSessionService.getAvailableGameSessions();
                this.server.emit(GameSessionEvents.GameSessionListUpdated, updatedAvailable);
                this.logger.log(`Joueur ${socket.id} a quitté la salle ${roomId}`);
            }
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


