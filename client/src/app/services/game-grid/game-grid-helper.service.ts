import { Injectable, inject } from '@angular/core';
import { AVATARS } from '@app/constants/character-constants';
import { GameSession } from '@app/interfaces/game-session';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket/game-session-socket.service';
import { Character } from '@common/character';
import { GameModeValue } from '@common/constants/game-config-constants';
import { TILE_COST, TileType } from '@common/map';
import { Position } from '@common/position';

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
