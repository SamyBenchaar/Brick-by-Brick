import { Injectable, inject } from '@angular/core';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { Character } from '@common/character';

@Injectable({
    providedIn: 'root',
})
export class GameGridHelperService {
    private gameSessionSocketService = inject(GameSessionSocketService);

    getCurrentPlayer(): Character | null {
        const socketId = this.gameSessionSocketService.getSocketId();
        const session = this.gameSessionSocketService.currentSession();
        if (!session) return null;

        const playerData = session.players.find(player => player.socketId === socketId);
        return playerData?.character ?? null;
    }
}
