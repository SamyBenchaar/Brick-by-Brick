import { LogEvents } from '@common/game.events';
import { LogMessage } from '@common/message';
import { Injectable, Logger } from '@nestjs/common';
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
export class LogGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;
    private readonly logger = new Logger('LogGateway');
    private logHistoryByGame = new Map<string, LogMessage[]>();

    afterInit() {
        this.logger.log('LogGateway initialized');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Client connected to LogGateway: ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Client disconnected from LogGateway: ${socket.id}`);
    }

    @SubscribeMessage(LogEvents.LoadLogHistory)
    handleLoadLogHistory(socket: Socket, payload: { gameId: string }) {
        const { gameId } = payload;
        const roomId = gameId;

        const logHistory = this.logHistoryByGame.get(roomId) || [];

        socket.join(`game-${roomId}`);

        socket.emit(LogEvents.LogHistory, logHistory);
    }

    @SubscribeMessage(LogEvents.ClearLogHistory)
    handleClearLogHistory(socket: Socket, payload: { gameId?: string }) {
        const roomId = payload.gameId || 'waiting-room';
        this.clearLogHistoryForRoom(roomId);
        this.server.to(`game-${roomId}`).emit(LogEvents.LogHistory, []);
    }

    clearLogHistoryForRoom(roomId: string): void {
        this.logHistoryByGame.delete(roomId);
    }

    sendLogMessage(roomId: string, logMessage: Omit<LogMessage, '_id'>): void {
        const log: LogMessage = {
            _id: this.generateMessageId(),
            timestamp: new Date(logMessage.timestamp),
            type: logMessage.type,
            content: logMessage.content,
            playersInvolved: logMessage.playersInvolved,
        };

        if (!this.logHistoryByGame.has(roomId)) {
            this.logHistoryByGame.set(roomId, []);
        }
        this.logHistoryByGame.get(roomId)?.push(log);

        this.server.to(`game-${roomId}`).emit(LogEvents.ReceiveLogMessage, log);
    }

    private generateMessageId(): string {
        const radix = 36;
        const substringStart = 2;
        const substringEnd = 9;
        return `msg_${Date.now()}_${Math.random().toString(radix).substr(substringStart, substringEnd)}`;
    }
}