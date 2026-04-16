import { GameSession } from '@app/interfaces/game-session';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { ToggleDebugModePayload } from '@app/interfaces/game-play';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { GameSessionEvents } from '@common/game.events';

export function registerSessionUpdateEventListeners(
    socketService: SocketService,
    gamePlaySocketService: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
): void {
    socketService.on<ToggleDebugModePayload>(GameSessionEvents.ToggleDebugMode, (data) => {
        gamePlaySocketService.isDebugModeActivated.set(data.isDebugModeActivated);
    });

    socketService.on<GameSession>(GameSessionEvents.GameSessionUpdated, (updatedGameSession) => {
        if (!updatedGameSession) {
            return;
        }

        gamePlaySocketService.clearAllPendingFlagTransferRequests();
        gameSessionSocketService.currentSession.set({ ...updatedGameSession });
    });
}
