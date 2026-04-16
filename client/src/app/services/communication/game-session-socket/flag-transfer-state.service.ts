import { Injectable } from '@angular/core';
import { FLAG_TRANSFER_TIMEOUT_MS } from '@app/constants/flag-transfer-constants';
import { PendingFlagTransferEntry } from '@app/interfaces/game-play';

@Injectable({
    providedIn: 'root',
})
export class FlagTransferStateService {
    private pendingTransfers = new Map<string, PendingFlagTransferEntry>();
    private pendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

    hasPendingTransfer(targetPlayerId: string): boolean {
        return this.pendingTransfers.has(targetPlayerId);
    }

    registerPendingTransfer(targetPlayerId: string): void {
        this.clearPendingTransfer(targetPlayerId);

        this.pendingTransfers.set(targetPlayerId, {
            targetPlayerId,
            createdAt: Date.now(),
        });

        const timeout = setTimeout(() => {
            this.clearPendingTransfer(targetPlayerId);
        }, FLAG_TRANSFER_TIMEOUT_MS);

        this.pendingTimeouts.set(targetPlayerId, timeout);
    }

    clearPendingTransfer(targetPlayerId: string): void {
        this.pendingTransfers.delete(targetPlayerId);

        const timeout = this.pendingTimeouts.get(targetPlayerId);
        if (timeout) {
            clearTimeout(timeout);
            this.pendingTimeouts.delete(targetPlayerId);
        }
    }

    clearAllPendingTransfers(): void {
        this.pendingTimeouts.forEach((timeout) => clearTimeout(timeout));
        this.pendingTimeouts.clear();
        this.pendingTransfers.clear();
    }

    getPendingTransferIds(): string[] {
        return [...this.pendingTransfers.keys()];
    }

    hasAnyPendingTransfer(): boolean {
        return this.pendingTransfers.size > 0;
    }
}
