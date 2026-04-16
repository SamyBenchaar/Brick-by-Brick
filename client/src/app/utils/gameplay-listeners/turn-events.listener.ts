import { MatDialog } from '@angular/material/dialog';
import { FlagTransferSocketService } from '@app/services/communication/game-session-socket/flag-transfer-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import {
    MoveExecutedPayload,
    ReachableTilesPayload,
    TurnStartedPayload,
    TurnStartingPayload,
} from '@app/services/communication/game-session-socket/game-play-types';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { handleTurnEnded } from '@app/utils/gameplay-listeners/gameplay-listeners-helper.service';
import { GameSessionEvents } from '@common/game.events';

export function registerTurnEventListeners(
    socketService: SocketService,
    gamePlaySocketService: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
    dialog: MatDialog,
    flagTransferService: FlagTransferSocketService,
): void {
    socketService.on<TurnStartingPayload>(GameSessionEvents.TurnStarting, (data) => {
        gamePlaySocketService.turnStarting.set(true);
        gamePlaySocketService.currentPlayerTurn.set(data.playerId);
        gamePlaySocketService.reachableTiles.set([]);
    });

    socketService.on<TurnStartedPayload>(GameSessionEvents.TurnStarted, (data) => {
        gamePlaySocketService.turnStarting.set(false);
        gamePlaySocketService.currentPlayerTurn.set(data.playerId);
        gamePlaySocketService.turnTimeRemaining.set(data.turnTime);

        const session = gamePlaySocketService.currentSession();
        if (!session) {
            return;
        }

        const player = session.players.find((playerEntry) => playerEntry.character.id === data.playerId);
        if (!player) {
            return;
        }

        player.character.remainingMovement = data.remainingMovement ?? player.character.remainingMovement;
        player.character.remainingActions = data.remainingActions ?? player.character.remainingActions;
        gameSessionSocketService.currentSession.set({ ...session });
    });

    socketService.on<{ timeRemaining: number }>(GameSessionEvents.TurnTimeUpdate, (data) => {
        gamePlaySocketService.turnTimeRemaining.set(data.timeRemaining);
    });

    socketService.on<{ timeRemaining: number }>(GameSessionEvents.InterTurnTimeUpdate, (data) => {
        gamePlaySocketService.interTurnTimeRemaining.set(data.timeRemaining);
    });

    socketService.on<{ playerId: string }>(GameSessionEvents.TurnEnded, () => {
        handleTurnEnded(gamePlaySocketService, dialog, flagTransferService);
    });

    socketService.on<MoveExecutedPayload>(GameSessionEvents.MoveExecuted, (data) => {
        const session = gamePlaySocketService.currentSession();
        if (!session) {
            return;
        }

        const player = session.players.find((playerEntry) => playerEntry.character.id === data.playerId);
        if (!player) {
            return;
        }

        player.character.position = data.position;
        player.character.remainingMovement = data.remainingMovement;
        player.character.remainingActions = data.remainingActions;
        gameSessionSocketService.currentSession.set({ ...session });
    });

    socketService.on<ReachableTilesPayload>(GameSessionEvents.ReachableTiles, (data) => {
        const session = gamePlaySocketService.currentSession();
        const socketId = gamePlaySocketService.getSocketId();

        if (!session || !socketId) {
            gamePlaySocketService.reachableTiles.set([]);
            return;
        }

        const currentUserPlayer = session.players.find((player) => player.socketId === socketId);
        if (!currentUserPlayer) {
            gamePlaySocketService.reachableTiles.set([]);
            return;
        }

        const belongsToCurrentUser = currentUserPlayer.character.id === data.playerId;
        const isCurrentTurnPlayer = gamePlaySocketService.currentPlayerTurn() === data.playerId;

        if (!belongsToCurrentUser || !isCurrentTurnPlayer) {
            gamePlaySocketService.reachableTiles.set([]);
            return;
        }

        gamePlaySocketService.reachableTiles.set(data.tiles);
    });
}
