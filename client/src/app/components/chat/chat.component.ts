import { CommonModule } from '@angular/common';
import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges, OnDestroy, OnInit,
    Output,
    SimpleChanges,
    ViewChild,
    effect, inject, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameLogComponent } from '@app/components/game-log/game-log.component';
import { ChatService } from '@app/services/communication/chat/chat.service';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { ChatMessage, MessageType } from '@common/message';
import { SessionStatus } from '@common/session.status';

@Component({
    selector: 'app-chat',
    standalone: true,
    imports: [CommonModule, FormsModule, GameLogComponent],
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnChanges, OnDestroy {
    @Input() username: string = 'Anonymous';
    @Input() gameId?: string;
    @Input() hostPlayerId?: string;
    @Input() isWriting: boolean = true;
    @Input() alwaysShowLog: boolean = false;
    @Output() isWritingChange = new EventEmitter<boolean>();
    @ViewChild('messagesContainer') messagesContainer!: ElementRef;
    private chatService = inject(ChatService);
    gameSessionSocketService = inject(GameSessionSocketService);

    messages: ChatMessage[] = [];
    messageInput = signal('');
    isLoading = signal(false);

    messageType = MessageType;
    activeTab = MessageType.CHAT;
    sessionStatus = SessionStatus;

    constructor() {
        effect(() => {
            this.messages = this.chatService.messages();
            this.scrollToBottom();
        });
    }

    ngOnInit(): void {
        const roomId = this.gameId || 'waiting-room';
        this.chatService.connect(this.username, roomId, this.hostPlayerId);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.gameId && !changes.gameId.firstChange) {
            this.chatService.clearMessages();
            this.messages = [];
            this.messageInput.set('');
            const roomId = this.gameId || 'waiting-room';
            this.chatService.loadChatHistory(this.username, roomId, this.hostPlayerId);
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
        this.chatService.sendMessage({
            username: this.username,
            content,
            gameId: roomId,
            hostPlayerId: this.hostPlayerId,
        });
        this.messageInput.set('');
        this.isWritingChange.emit(false);
    }

    clearChat(): void {
        this.messages = [];
        this.chatService.clearMessages();
        const roomId = this.gameId || 'waiting-room';
        this.chatService.clearChatHistoryOnServer(roomId);
    }

    onFocus(): void {
        this.isWritingChange.emit(true);
    }

    onKeyPress(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            this.isWritingChange.emit(false);
            event.preventDefault();
            this.sendMessage();
        }
    }

    private scrollToBottom(): void {
        if (this.messagesContainer) {
            setTimeout(() => {
                const el = this.messagesContainer.nativeElement;
                el.scrollTop = el.scrollHeight;
            }, 0);
        }
    }
}
