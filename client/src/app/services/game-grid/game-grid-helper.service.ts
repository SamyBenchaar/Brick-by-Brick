import { Injectable, inject } from '@angular/core';
import { AVATARS } from '@app/constants/character-constants';
import { GameSession } from '@app/interfaces/game-session';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { Character } from '@common/character';
import { TILE_COST, TileType } from '@common/map';
import { Position } from '@common/position';

@Injectable({
    providedIn: 'root',
})
export class GameGridHelperService {
    private gameSessionSocketService = inject(GameSessionSocketService);

    getPlayerAtPosition(players: Character[], position: Position): Character | null {
        return players.find(player => player.position?.x === position.x && player.position?.y === position.y) ?? null;
    }

    isReachableTile(reachableTiles: Position[], position: Position): boolean {
        return reachableTiles.some(tilePosition => tilePosition.x === position.x && tilePosition.y === position.y);
    }

    getAvatarImage(avatarId: number): string {
        return AVATARS.find(avatarOption => avatarOption.id === avatarId)?.image ?? 'assets/images/lily.jpg';
    }

    getTileCost(tileType: TileType): number {
        return TILE_COST[tileType] ?? 0;
    }

    isFlagHeldByPlayer(players: Character[], position: Position): boolean {
        return players.some(player => player.position?.x === position.x && player.position?.y === position.y && player.hasFlag);
    }

    getPlayerTeamClass(player: Character): string {
        const session = this.gameSessionSocketService.currentSession() as GameSession | null;

        if (!session) return '';
        if (session.gameMode !== 'ctf') return '';
        if (!session.playerTeams) return '';

        let team: string | undefined;
        if (session.playerTeams instanceof Map) {
            team = session.playerTeams.get(player.id);
        } else {
            team = (session.playerTeams as Record<string, string>)[player.id];
        }
        return team ? `player-team-${team}` : '';
    }

    getCurrentPlayer(): Character | null {
        const socketId = this.gameSessionSocketService.getSocketId();
        const session = this.gameSessionSocketService.currentSession();
        if (!session) return null;

        const playerData = session.players.find(player => player.socketId === socketId);
        return playerData?.character ?? null;
    }
}
