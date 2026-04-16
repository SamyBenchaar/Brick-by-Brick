import { PlayerAbandonedPayload } from '@app/interfaces/gameplay-listeners';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { GameSessionEvents } from '@common/game.events';

export function registerAbandonEventListeners(
    socketService: SocketService,
    gamePlaySocketService: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
    combatSocketService: CombatSocketService,
): void {
    socketService.on<PlayerAbandonedPayload>(GameSessionEvents.PlayerAbandoned, (data) => {
        const session = gamePlaySocketService.currentSession();
        if (!session) {
            return;
        }

        const leftPlayer = session.players.find((player) => player.character.id === data.playerId);
        if (leftPlayer) {
            session.leftPlayers = [...(session.leftPlayers ?? []), leftPlayer];
        }

        session.players = session.players.filter((player) => player.character.id !== data.playerId);

        if (session.playerOrder) {
            session.playerOrder = session.playerOrder.filter((id) => id !== data.playerId);
        }

        if (data.mapCopyTiles) {
            const currentMap = gamePlaySocketService.mapCopy();
            if (currentMap) {
                gamePlaySocketService.mapCopy.set({
                    ...currentMap,
                    mapConfig: {
                        ...currentMap.mapConfig,
                        tiles: data.mapCopyTiles,
                    },
                });
            }
        }

        if (data.flagPosition) {
            session.flagPosition = data.flagPosition;
        }

        if (data.flagHolderId) {
            session.flagHolderId = data.flagHolderId;
        }

        combatSocketService.activeCombat.set(null);
        gameSessionSocketService.currentSession.set({ ...session });
    });
}
