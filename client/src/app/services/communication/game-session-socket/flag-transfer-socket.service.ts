import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { GameSessionEvents } from '@common/game.events';

@Injectable({
    providedIn: 'root',
})
export class FlagTransferSocketService {
    isFlagTransferModalOpen: WritableSignal<boolean> = signal<boolean>(false);

    private pendingFlagTransferTimeouts: Map<string, number> = new Map();
    private pendingFlagTransferDialogs: Map<string, { dialogRef: MatDialogRef<AppDialogComponent>; fromPlayerId: string }> =
        new Map();

    private socketService = inject(SocketService);

    requestFlagTransfer(roomId: string, toPlayerId: string): void {
        this.socketService.emit(GameSessionEvents.RequestFlagTransfer, {
            roomId,
            toPlayerId,
        });
    }

    respondToFlagTransfer(roomId: string, fromPlayerId: string, accepted: boolean): void {
        this.socketService.emit(GameSessionEvents.FlagTransferResponse, {
            roomId,
            fromPlayerId,
            accepted,
        });
    }

    setPendingFlagTransferTimeout(fromPlayerId: string, timeout: ReturnType<typeof setTimeout>): void {
        this.pendingFlagTransferTimeouts.set(fromPlayerId, timeout as unknown as number);
    }

    clearPendingFlagTransfer(fromPlayerId: string): void {
        const existingTimeout = this.pendingFlagTransferTimeouts.get(fromPlayerId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            this.pendingFlagTransferTimeouts.delete(fromPlayerId);
        }
    }

    clearAllPendingFlagTransfers(): void {
        this.pendingFlagTransferDialogs.forEach((data) => {
            data.dialogRef.close(false);
        });
        this.pendingFlagTransferDialogs.clear();

        this.pendingFlagTransferTimeouts.forEach((timeout) => {
            clearTimeout(timeout);
        });
        this.pendingFlagTransferTimeouts.clear();
    }

    getPendingFlagTransferDialogs(): [string, { dialogRef: MatDialogRef<AppDialogComponent>; fromPlayerId: string }][] {
        return Array.from(this.pendingFlagTransferDialogs.entries());
    }

    setPendingFlagTransferDialog(
        toPlayerId: string,
        dialogRef: MatDialogRef<AppDialogComponent>,
        fromPlayerId: string,
    ): void {
        this.pendingFlagTransferDialogs.set(toPlayerId, { dialogRef, fromPlayerId });
    }

    removePendingFlagTransferDialog(toPlayerId: string): void {
        this.pendingFlagTransferDialogs.delete(toPlayerId);
    }
}
