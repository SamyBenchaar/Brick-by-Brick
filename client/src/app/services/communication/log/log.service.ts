import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { LogEvents } from '@common/game.events';
import { LogMessage } from '@common/message';

@Injectable({
    providedIn: 'root',
})
export class LogService {
    logs: WritableSignal<LogMessage[]> = signal<LogMessage[]>([]);

    private socketService = inject(SocketService);

    connect(gameId?: string): void {
        if (!this.socketService.isConnected()) {
            this.socketService.connect();
        }

        this.setupEventListeners();
        this.loadLogHistory(gameId);
    }

    disconnect(): void {
        this.socketService.off(LogEvents.ReceiveLogMessage);
        this.socketService.off(LogEvents.LogHistory);
    }

    private setupEventListeners(): void {
        this.socketService.on<LogMessage>(LogEvents.ReceiveLogMessage, (log: LogMessage) => {
            this.logs.update(currentLogs => [...currentLogs, log]);
        });

        this.socketService.on<LogMessage[]>(LogEvents.LogHistory, (history: LogMessage[]) => {
            this.logs.set(history);
        });
    }

    loadLogHistory(gameId?: string): void {
        this.socketService.emit(LogEvents.LoadLogHistory, { gameId });
    }

    clearLogHistoryOnServer(gameId?: string): void {
        this.socketService.emit(LogEvents.ClearLogHistory, { gameId });
    }

    getCurrentLogs(): LogMessage[] {
        return this.logs();
    }

    clearLogs(): void {
        this.logs.set([]);
    }
}