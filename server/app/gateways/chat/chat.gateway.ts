import { ChatEvents } from '@common/game.events';
import { ChatMessage } from '@common/message';
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
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() private server: Server;
    private readonly logger = new Logger('ChatGateway');
    private chatHistoryByGame = new Map<string, ChatMessage[]>(); 
    private userSessions = new Map<string, { username: string; gameId: string }>(); 

    afterInit() {
        this.logger.log('ChatGateway initialisé');
    }

    handleConnection(socket: Socket) {
        this.logger.log(`Client connecté au ChatGateway: ${socket.id}`);
    }

    handleDisconnect(socket: Socket) {
        this.logger.log(`Client déconnecté du ChatGateway: ${socket.id}`);
        this.userSessions.delete(socket.id);
    }

    @SubscribeMessage(ChatEvents.LoadChatHistory)
    handleLoadChatHistory(socket: Socket, payload: { username: string; gameId: string }) {
        const { username, gameId } = payload;
        const roomId = gameId || 'waiting-room';

        this.userSessions.set(socket.id, { username, gameId: roomId });

        // Get chat history for this specific game room
        const gameHistory = this.chatHistoryByGame.get(roomId) || [];

        // Join socket to game room
        socket.join(`game-${roomId}`);

        // Send chat history for this room
        socket.emit(ChatEvents.ChatHistory, gameHistory);
    }

    @SubscribeMessage(ChatEvents.SendMessage)
    handleSendMessage(socket: Socket, message: Omit<ChatMessage, '_id'>) {
        const chatMessage: ChatMessage = {
            _id: this.generateMessageId(),
            username: message.username,
            content: message.content,
            timestamp: new Date(message.timestamp),
            gameId: message.gameId,
        };

        const roomId = chatMessage.gameId || 'waiting-room';

        if (!this.chatHistoryByGame.has(roomId)) {
            this.chatHistoryByGame.set(roomId, []);
        }
        this.chatHistoryByGame.get(roomId)?.push(chatMessage);

        this.server.to(`game-${roomId}`).emit(ChatEvents.ReceiveMessage, chatMessage);
    }

    @SubscribeMessage(ChatEvents.ClearChatHistory)
    handleClearChatHistory(socket: Socket, payload: { gameId?: string }) {
        const roomId = payload.gameId || 'waiting-room';
        this.chatHistoryByGame.delete(roomId);
        this.server.to(`game-${roomId}`).emit(ChatEvents.ChatHistory, []);
    }

    private generateMessageId(): string {
        const radix = 36;
        const substringStart = 2;
        const substringEnd = 9;
        return `msg_${Date.now()}_${Math.random().toString(radix).substr(substringStart, substringEnd)}`;
    }
}
