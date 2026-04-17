import { Injectable, signal, WritableSignal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';

@Injectable({
    providedIn: 'root',
})
export class FlagTransferSocketService {
    isFlagTransferModalOpen: WritableSignal<boolean> = signal<boolean>(false);

    private pendingFlagTransferTimeouts: Map<string, number> = new Map();
    private pendingFlagTransferDialogs: Map<string, { dialogRef: MatDialogRef<AppDialogComponent>; fromPlayerId: string }> =
        new Map();


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
