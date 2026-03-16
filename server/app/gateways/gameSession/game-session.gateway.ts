import { GameSession } from '@app/domain/game-session';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GameSessionService } from '@app/services/gameSession/gameSession.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { Player } from '@common/player';
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

    private socketToRoom: Map<string, string> = new Map();

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
        if (roomId) {
            const gameSession = this.gameSessionService.getGameSession(roomId);
            if (gameSession?.status === 'playing') {
                this.handlePlayingDisconnect(socket, roomId);
            } else {
                this.handleLeaveLogic(socket, roomId);
            }
        }
    }

    @SubscribeMessage(GameSessionEvents.RequestGameSessionList)
    handleRequestAvailableGameSessionList(socket: Socket) {
        const gameSessions = this.gameSessionService.getAvailableGameSessions();
        socket.emit(GameSessionEvents.GameSessionList, gameSessions);
    }

    @SubscribeMessage(GameSessionEvents.CreateGameSession)
    async handleCreateGameSession(socket: Socket, payload: { gameId: string; hostPlayer: Character }) {
        const { gameId, hostPlayer } = payload;
        const player = this.createPlayer(socket.id, hostPlayer);
        const gameSession = await this.gameSessionService.createGameSession(player, gameId);

        socket.join(gameSession.roomId);
        this.socketToRoom.set(socket.id, gameSession.roomId);

        this.notifyGameSessionCreated(gameSession);
        this.logger.log(`Salle créée : ${gameSession.roomId} par ${socket.id}`);
    }

    @SubscribeMessage(GameSessionEvents.JoinGameSession)
    handleJoinGameSession(socket: Socket, payload: { roomId: string; player: Character }) {
        const { roomId, player: character } = payload;
        const player = this.createPlayer(socket.id, character);
        const gameSession = this.getSessionOrFail(socket, payload.roomId);
        if (!gameSession) return;

        const error = this.gameSessionService.joinSession(gameSession.roomId, player);
        if (error) {
            socket.emit(GameSessionEvents.GameSessionJoinError, error);
            return;
        }

        socket.join(roomId);
        this.socketToRoom.set(socket.id, roomId);
        this.server.to(roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        this.notifyGameSessionListUpdated();
        this.logger.log(`Joueur ${socket.id} a rejoint la salle ${roomId}`);
    }

    @SubscribeMessage(GameSessionEvents.ObserveGameSession)
    handleObserveGameSession(socket: Socket, payload: { roomId: string }) {
        const gameSession = this.getSessionOrFail(socket, payload.roomId);
        if (!gameSession) return;
        socket.join(payload.roomId);
        this.socketToRoom.set(socket.id, payload.roomId);
        socket.emit(GameSessionEvents.AvatarTakenUpdated, gameSession.getTakenAvatars());
    }

    @SubscribeMessage(GameSessionEvents.LeaveGameSession)
    handleLeaveGameSession(socket: Socket, payload: { roomId: string }) {
        this.handleLeaveLogic(socket, payload.roomId);
    }

    @SubscribeMessage(GameSessionEvents.KickPlayer)
    handleKickPlayer(socket: Socket, payload: { roomId: string; targetId: string }) {
        const gameSession = this.getSessionOrFail(socket, payload.roomId);
        if (!gameSession) return;

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

        const updatedSession = this.getSessionOrFail(socket, payload.roomId);
        if (!updatedSession) return;
        this.notifyGameSessionUpdated(updatedSession);

        this.logger.log(`Joueur ${payload.targetId} exclu de la salle ${payload.roomId}`);
    }

    private handlePlayingDisconnect(socket: Socket, roomId: string) {
        const gameSession = this.gameSessionService.getGameSession(roomId);
        if (gameSession.isHost(socket.id)) {
            this.deactivateDebugMode(gameSession);
        }
        this.socketToRoom.delete(socket.id);
        socket.leave(roomId);

        this.gameSessionService.removePlayer(roomId, socket.id);

        this.server.to(roomId).emit(GameSessionEvents.PlayerAbandoned, {
            playerId: socket.id,
        });

        this.logger.log(`Joueur ${socket.id} abandonné pendant la partie ${roomId}`);
    }

    @SubscribeMessage(GameSessionEvents.AvatarTakenUpdated)
    handleAvatarTakenUpdated(socket: Socket, payload: { roomId: string; newAvatarId: number; }) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);

        if (!gameSession) {
            this.logger.warn(`Session ${payload.roomId} introuvable pour AvatarTakenUpdated`);
            return;
        }

        gameSession.socketToAvatar.set(socket.id, payload.newAvatarId);

        this.notifyAvatarTakenUpdated(payload.roomId, gameSession.getTakenAvatars());
        this.logger.log(`Avatar ${payload.newAvatarId} marqué comme pris dans la salle ${payload.roomId}`);
    }

    private handleLeaveLogic(socket: Socket, roomId: string) {
        const gameSession = this.gameSessionService.getGameSession(roomId);
        if (!gameSession) return;

        this.socketToRoom.delete(socket.id);
        socket.leave(roomId);
        gameSession.socketToAvatar.delete(socket.id);
        this.notifyAvatarTakenUpdated(roomId, gameSession.getTakenAvatars());

        if (gameSession.isHost(socket.id)) {
            this.handleHostLeave(gameSession);
        } else {
            this.handlePlayerLeave(gameSession, socket.id);
        }
    }

    private handleHostLeave(session: GameSession) {
        const roomId = session.roomId;

        this.deactivateDebugMode(session);

        this.server.to(roomId).emit(GameSessionEvents.RoomCancelled, {
            message: "L'organisateur a quitté la salle. La partie est annulée.",
        });
        this.cleanUpRoom(roomId);
    }

    private handlePlayerLeave(session: GameSession, socketId: string) {
        const roomId = session.roomId;

        session.removePlayer(socketId);

        if (session.players.length === 0) {
            this.cleanUpRoom(roomId);
            return;
        }
        this.notifyGameSessionListUpdated();
        this.notifyGameSessionUpdated(session);
    }

    cleanUpRoom(roomId: string) {
        this.notifyAvatarTakenUpdated(roomId, []);
        this.deactivateDebugMode(this.gameSessionService.getGameSession(roomId));
        this.gameSessionService.deleteGameSession(roomId);
        this.chatGateway.clearChatHistoryForRoom(roomId);
        this.notifyGameSessionDeleted(roomId);
    }

    private getSessionOrFail(socket: Socket, roomId: string): GameSession | null {
        const session = this.gameSessionService.getGameSession(roomId);
        if (!session) {
            socket.emit(GameSessionEvents.GameSessionJoinError, 'Session introuvable');
            return null;
        }
        return session;
    }

    private createPlayer(socketId: string, character: Character): Player {
        character.id = socketId;
        return { socketId, character };
    }

    private deactivateDebugMode(gameSession: GameSession): void {
        if (gameSession && gameSession.isDebugModeActivated) {
            gameSession.isDebugModeActivated = false;
            this.server.to(gameSession.roomId).emit(GameSessionEvents.ToggleDebugMode, {
                isDebugModeActivated: false,
            });
        }
    }

    notifyGameSessionCreated(gameSession: GameSession): void {
        this.server.emit(GameSessionEvents.GameSessionCreated, gameSession);
    }

    notifyGameSessionUpdated(gameSession: GameSession): void {
        this.notifyAvatarTakenUpdated(gameSession.roomId, gameSession.getTakenAvatars());
        this.server.emit(GameSessionEvents.GameSessionUpdated, gameSession);
    }

    private notifyGameSessionListUpdated() {
        const sessions = this.gameSessionService.getAvailableGameSessions();
        this.server.emit(GameSessionEvents.GameSessionListUpdated, sessions);
    }

    notifyGameSessionDeleted(gameSessionId: string): void {
        this.server.emit(GameSessionEvents.GameSessionDeleted, gameSessionId);
    }

    notifyAvatarTakenUpdated(roomId: string, takenAvatars: number[]): void {
        this.server.to(roomId).emit(GameSessionEvents.AvatarTakenUpdated, takenAvatars);
    }
}