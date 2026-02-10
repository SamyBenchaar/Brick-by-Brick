import { Injectable } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class SocketService {
    private socket: Socket | null = null;

    connect(): string {
        if (!this.socket) {
            this.socket = io(environment.serverUrl.replace('/api', ''), {
                transports: ['websocket'],
            });
        }

        return this.socket.id || '';
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on<T>(event: string, action: (data: T) => void): void {
        if (this.socket) {
            this.socket.on(event, action);
        }
    }

    off(event: string): void {
        if (this.socket) {
            this.socket.off(event);
        }
    }

    emit<T>(event: string, data?: T, callback?: (response: never) => void): void {
        if (this.socket) {
            if (callback) {
                this.socket.emit(event, data, callback);
            } else if (data !== undefined) {
                this.socket.emit(event, data);
            } else {
                this.socket.emit(event);
            }
        }
    }

    isConnected(): boolean {
        return this.socket?.connected || false;
    }

    getSocketId(): string | undefined {
        return this.socket?.id;
    }
}
