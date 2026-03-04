import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from '@app/services/communication/chat.service';
import { ChatMessage } from '@common/message';

@Component({
    selector: 'app-chat',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnChanges, OnDestroy {
    @Input() username: string = 'Anonymous';
    @Input() gameId?: string;

    private chatService = inject(ChatService);

    messages: ChatMessage[] = [];
    messageInput = signal('');
    isLoading = signal(false);

    constructor() {
        effect(() => {
            this.messages = this.chatService.messages();
            this.scrollToBottom();
        });
    }

    ngOnInit(): void {
        const roomId = this.gameId || 'waiting-room';
        this.chatService.connect(this.username, roomId);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.gameId && !changes.gameId.firstChange) {
            this.chatService.clearMessages();
            this.messages = [];
            this.messageInput.set('');
            // a voir si ceci marche avec un gameID
            const roomId = this.gameId || 'waiting-room';
            this.chatService.loadChatHistory(this.username, roomId);
        }
    }

    ngOnDestroy(): void {
        this.chatService.disconnect();
    }

    sendMessage(): void {
        const content = this.messageInput().trim();
        if (!content) {
            return;
        }

        const roomId = this.gameId || 'waiting-room';
        this.chatService.sendMessage(this.username, content, roomId);
        this.messageInput.set('');
    }

    clearChat(): void {
        this.messages = [];
        this.chatService.clearMessages();
        const roomId = this.gameId || 'waiting-room';
        this.chatService.clearChatHistoryOnServer(roomId);
    }

    onKeyPress(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    private scrollToBottom(): void {
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 0);
        }
    }
}
