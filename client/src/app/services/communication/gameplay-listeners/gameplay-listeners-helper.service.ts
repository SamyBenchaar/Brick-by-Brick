import { MatDialog } from '@angular/material/dialog';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';
import { FlagTransferSocketService } from '@app/services/communication/game-session-socket/flag-transfer-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import type { CombatResultPayload } from '@common/combat';

export function handleTurnEnded(
    service: GamePlaySocketService,
    dialog: MatDialog,
    flagTransferService: FlagTransferSocketService,
): void {
    service.currentPlayerTurn.set(null);
    service.reachableTiles.set([]);
    dialog.getDialogById('sanctuary-dialog')?.close('dismiss');

    closePendingFlagTransferDialogs(service, flagTransferService);
    decrementSanctuaryCooldowns(service);
}

export function handleCombatResult(
    data: CombatResultPayload,
    service: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
    combatSocketService: CombatSocketService,
): void {
    service.reachableTiles.set([]);
    combatSocketService.activeCombat.set(null);
    combatSocketService.latestRound.set(null);
    combatSocketService.combatTurnTimeRemaining.set(null);

    updateSessionAfterCombatResult(data, service, gameSessionSocketService);
    notifyCurrentPlayerCombatResult(data, service, combatSocketService);
}

function closePendingFlagTransferDialogs(
    service: GamePlaySocketService,
    flagTransferService: FlagTransferSocketService,
): void {
    const pendingDialogs = flagTransferService.getPendingFlagTransferDialogs();

    pendingDialogs.forEach(([, data]) => {
        data.dialogRef.close(false);
        service.respondToFlagTransfer(data.fromPlayerId, false);
    });

    flagTransferService.clearAllPendingFlagTransfers();
}

function decrementSanctuaryCooldowns(service: GamePlaySocketService): void {
    const currentMap = service.mapCopy();
    if (!currentMap) {
        return;
    }

    let changed = false;

    for (const row of currentMap.mapConfig.tiles) {
        for (const tile of row) {
            if (!tile.sanctuaryCooldown || tile.sanctuaryCooldown <= 0) {
                continue;
            }

            tile.sanctuaryCooldown--;
            if (tile.sanctuaryCooldown === 0) {
                delete tile.sanctuaryCooldown;
            }
            changed = true;
        }
    }

    if (changed) {
        service.mapCopy.set({ ...currentMap });
    }
}

function updateSessionAfterCombatResult(
    data: CombatResultPayload,
    service: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
): void {
    const session = service.currentSession();
    if (!session) {
        return;
    }

    const attacker = session.players.find((player) => player.character.id === data.attackerId);
    const defender = session.players.find((player) => player.character.id === data.defenderId);

    if (attacker) {
        attacker.character.position = data.attackerPosition;
        attacker.character.life = data.attackerLife;
        attacker.character.victories = data.attackerVictories;
        attacker.character.remainingActions = data.remainingActions;
        attacker.character.hasFlag = data.flagHolderId === attacker.character.id;
    }

    if (defender) {
        defender.character.position = data.defenderPosition;
        defender.character.life = data.defenderLife;
        defender.character.victories = data.defenderVictories;
        defender.character.hasFlag = data.flagHolderId === defender.character.id;
    }

    session.flagPosition = data.flagPosition;
    session.flagHolderId = data.flagHolderId;
    gameSessionSocketService.currentSession.set({ ...session });
}

function notifyCurrentPlayerCombatResult(
    data: CombatResultPayload,
    service: GamePlaySocketService,
    combatSocketService: CombatSocketService,
): void {
    const currentPlayer = service.getCurrentPlayerCharacter();
    if (!currentPlayer) {
        return;
    }

    const currentPlayerWasInCombat =
        currentPlayer.id === data.attackerId || currentPlayer.id === data.defenderId;

    if (!currentPlayerWasInCombat) {
        return;
    }

    if (data.outcome === 'draw') {
        combatSocketService.showCombatNotification('Le combat s\'est terminé par un match nul.');
        return;
    }

    const currentPlayerWon = data.winnerId === currentPlayer.id;
    const notificationMessage = currentPlayerWon
        ? 'Vous avez remporté le combat.'
        : 'Vous avez perdu le combat.';

    combatSocketService.showCombatNotification(notificationMessage);
}
