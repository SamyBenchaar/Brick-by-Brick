import { Injectable } from '@angular/core';
import { Character, Position } from '@common/character';
import { GameEvents } from '@common/game.events';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
    providedIn: 'root',
})
export class GameSessionService {
    private socket: Socket | null = null;
    private currentPlayerId: string = '';
    private players: Map<string, Character> = new Map();
    private eventSubjects: Map<string, Subject<unknown>> = new Map();

    constructor() {
        this.initializeSocket();
    }

    private initializeSocket(): void {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = window.location.host;
        this.socket = io(`${protocol}://${host}`, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => {
            // connection 
        });

        this.socket.on('disconnect', () => {
            // disconnection
        });

        this.socket.on('error', (error: unknown) => {
            const subject = this.on('error');
            subject.next(error);
        });
    }

    setCurrentPlayerId(playerId: string): void {
        this.currentPlayerId = playerId;
    }

    getCurrentPlayerId(): string {
        return this.currentPlayerId;
    }

    joinGameSession(roomId: string, player: Character): void {
        if (!this.socket) return;

        this.currentPlayerId = player.id;
        this.players.set(player.id, player);

        this.socket.emit(GameEvents.JoinGameSession, {
            roomId,
            player,
        });
    }

    leaveGameSession(roomId: string): void {
        if (!this.socket) return;
        this.socket.emit(GameEvents.PlayerAbandoned, { roomId });
    }

    startGame(roomId: string): void {
        if (!this.socket) return;
        this.socket.emit('startGame', { roomId });
    }

    requestMove(roomId: string, direction: string, playerId: string): void {
        if (!this.socket) return;
        this.socket.emit(GameEvents.RequestMove, {
            roomId,
            direction,
            playerId,
        });
    }

    requestCombat(roomId: string, defenderId: string, playerId: string): void {
        if (!this.socket) return;
        this.socket.emit(GameEvents.RequestCombat, {
            roomId,
            defenderId,
            playerId,
        });
    }

    endTurn(roomId: string, playerId: string): void {
        if (!this.socket) return;
        this.socket.emit(GameEvents.EndTurnRequest, {
            roomId,
            playerId,
        });
    }

    abandonGame(roomId: string): void {
        if (!this.socket) return;
        this.socket.emit(GameEvents.PlayerAbandoned, { roomId });
    }

    on(eventName: string): Subject<unknown> {
        let subject = this.eventSubjects.get(eventName);

        if (!subject) {
            subject = new Subject<unknown>();
            this.eventSubjects.set(eventName, subject);

            if (this.socket) {
                const currentSubject = subject;
                this.socket.on(eventName, (data) => {
                    currentSubject.next(data);
                });
            }
        }

        return subject;
    }

    getAllPlayers(): Character[] {
        return Array.from(this.players.values());
    }

    getPlayerById(playerId: string): Character | undefined {
        return this.players.get(playerId);
    }

    addPlayer(player: Character): void {
        this.players.set(player.id, player);
    }

    removePlayer(playerId: string): void {
        this.players.delete(playerId);
    }

    updatePlayerPosition(playerId: string, position: Position): void {
        const player = this.players.get(playerId);
        if (player) {
            player.position = position;
        }
    }

    getPlayerAtPosition(position: Position): Character | null {
        for (const player of this.players.values()) {
            if (player.position?.x === position.x && player.position?.y === position.y) {
                return player;
            }
        }
        return null;
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}
