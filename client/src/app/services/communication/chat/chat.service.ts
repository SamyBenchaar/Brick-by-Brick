import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { SendChatMessagePayload } from '@app/interfaces/chat-payloads';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { ChatEvents } from '@common/game.events';
import { ChatMessage } from '@common/message';

@Injectable({
    providedIn: 'root',
})
export class ChatService {
    messages: WritableSignal<ChatMessage[]> = signal<ChatMessage[]>([]);
    isLoading: WritableSignal<boolean> = signal(false);

    private socketService = inject(SocketService);

    connect(username: string, gameId?: string, hostPlayerId?: string): void {
        if (!this.socketService.isConnected()) {
            this.socketService.connect();
        }

        this.setupEventListeners();
        this.loadChatHistory(username, gameId, hostPlayerId);
    }

    disconnect(): void {
        this.socketService.off(ChatEvents.ReceiveMessage);
        this.socketService.off(ChatEvents.ChatHistory);
    }

    private setupEventListeners(): void {
        this.socketService.on<ChatMessage>(ChatEvents.ReceiveMessage, (message: ChatMessage) => {
            this.messages.update(currentMessages => [...currentMessages, message]);
        });

        this.socketService.on<ChatMessage[]>(ChatEvents.ChatHistory, (history: ChatMessage[]) => {
            this.messages.set(history);
            this.isLoading.set(false);
        });
    }

    sendMessage(payload: SendChatMessagePayload): void {
        const { username, content, gameId, hostPlayerId } = payload;
        if (!content.trim()) {
            return;
        }

        const message: Omit<ChatMessage, '_id'> = {
            username,
            content,
            timestamp: new Date(),
            gameId,
            hostPlayerId,
        };

        this.socketService.emit(ChatEvents.SendMessage, message);
    }

    loadChatHistory(username: string, gameId?: string, hostPlayerId?: string): void {
        this.isLoading.set(true);
        this.socketService.emit(ChatEvents.LoadChatHistory, { username, gameId, hostPlayerId });
    }

    clearChatHistoryOnServer(gameId?: string): void {
        this.socketService.emit(ChatEvents.ClearChatHistory, { gameId });
    }

    getCurrentMessages(): ChatMessage[] {
        return this.messages();
    }

    clearMessages(): void {
        this.messages.set([]);
    }
}
