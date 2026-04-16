import { MatDialog } from '@angular/material/dialog';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { DialogType } from '@app/constants/dialog-type.enum';
import {
    FlagTransferRequestPayload,
} from '@app/interfaces/game-play';
import { FlagTransferSocketService } from '@app/services/communication/game-session-socket/flag-transfer-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { GameSessionEvents } from '@common/game.events';

export function registerFlagTransferEventListeners(
    socketService: SocketService,
    gamePlaySocketService: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
    dialog: MatDialog,
    flagTransferService: FlagTransferSocketService,
): void {
    socketService.on<FlagTransferRequestPayload>(GameSessionEvents.RequestFlagTransfer, (data) => {
        const socketId = gamePlaySocketService.getSocketId();
        const session = gameSessionSocketService.currentSession();

        if (!session) {
            return;
        }

        const currentPlayer = session.players.find((player) => player.socketId === socketId);
        if (!currentPlayer) {
            return;
        }

        const dialogRef = dialog.open(AppDialogComponent, {
            data: {
                title: 'Demande de transfert de drapeau',
                message: `${data.fromPlayerName} veut vous transférer le drapeau. Acceptez-vous?`,
                type: DialogType.WARNING,
                confirmText: 'Accepter',
                cancelText: 'Refuser',
            },
        });

        flagTransferService.setPendingFlagTransferDialog(
            currentPlayer.character.id,
            dialogRef,
            data.fromPlayerId,
        );

        dialogRef.afterClosed().subscribe((accepted: boolean) => {
            flagTransferService.removePendingFlagTransferDialog(currentPlayer.character.id);
            gamePlaySocketService.respondToFlagTransfer(data.fromPlayerId, Boolean(accepted));
        });
    });
}
