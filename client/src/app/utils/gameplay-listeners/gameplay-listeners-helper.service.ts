import { MatDialog } from '@angular/material/dialog';
import { CombatResultListenerDependencies } from '@app/interfaces/gameplay-listener-dependencies';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';
import { FlagTransferSocketService } from '@app/services/communication/game-session-socket/flag-transfer-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import type { CombatEndedPayload, CombatResultPayload } from '@common/combat';

export function handleTurnEnded(
    gamePlaySocketService: GamePlaySocketService,
    dialog: MatDialog,
    flagTransferService: FlagTransferSocketService,
): void {
    gamePlaySocketService.currentPlayerTurn.set(null);
    gamePlaySocketService.reachableTiles.set([]);
    dialog.getDialogById('sanctuary-dialog')?.close('dismiss');

    closePendingFlagTransferDialogs(gamePlaySocketService, flagTransferService);
    decrementSanctuaryCooldowns(gamePlaySocketService);
}

export function handleCombatResult(
    data: CombatResultPayload,
    dependencies: CombatResultListenerDependencies,
): void {
    const {
        gamePlaySocketService,
        gameSessionSocketService,
        combatSocketService,
    } = dependencies;

    gamePlaySocketService.reachableTiles.set([]);
    combatSocketService.activeCombat.set(null);
    combatSocketService.latestRound.set(null);
    combatSocketService.combatTurnTimeRemaining.set(null);

    updateSessionAfterCombatResult(data, gamePlaySocketService, gameSessionSocketService);
    notifyCurrentPlayerCombatResult(data, gamePlaySocketService, combatSocketService);
}

function closePendingFlagTransferDialogs(
    gamePlaySocketService: GamePlaySocketService,
    flagTransferService: FlagTransferSocketService,
): void {
    const pendingDialogs = flagTransferService.getPendingFlagTransferDialogs();

    pendingDialogs.forEach(([, dialogData]) => {
        dialogData.dialogRef.close(false);
        gamePlaySocketService.respondToFlagTransfer(dialogData.fromPlayerId, false);
    });

    flagTransferService.clearAllPendingFlagTransfers();
    gamePlaySocketService.clearAllPendingFlagTransferRequests();
}

function decrementSanctuaryCooldowns(gamePlaySocketService: GamePlaySocketService): void {
    const currentMap = gamePlaySocketService.mapCopy();
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
        gamePlaySocketService.mapCopy.set({ ...currentMap });
    }
}

function updateSessionAfterCombatResult(
    data: CombatResultPayload,
    gamePlaySocketService: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
): void {
    const session = gamePlaySocketService.currentSession();
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
    gamePlaySocketService: GamePlaySocketService,
    combatSocketService: CombatSocketService,
): void {
    const currentPlayer = gamePlaySocketService.getCurrentPlayerCharacter();
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

export function handleCombatEnded(
    data: CombatEndedPayload,
    dependencies: CombatResultListenerDependencies,
): void {
    const {
        gamePlaySocketService,
        gameSessionSocketService,
        combatSocketService,
    } = dependencies;

    gamePlaySocketService.reachableTiles.set([]);
    combatSocketService.activeCombat.set(null);
    combatSocketService.latestRound.set(null);
    combatSocketService.combatTurnTimeRemaining.set(null);

    if (data.reason !== 'playerLeft' || data.survivorId === undefined || data.survivorVictories === undefined) {
        return;
    }

    const session = gamePlaySocketService.currentSession();
    if (session) {
        const survivor = session.players.find((player) => player.character.id === data.survivorId);
        if (survivor) {
            survivor.character.victories = data.survivorVictories;
        }
        gameSessionSocketService.currentSession.set({ ...session });
    }

    notifySurvivorOfForfeitWin(data, gamePlaySocketService, combatSocketService);
}

function notifySurvivorOfForfeitWin(
    data: CombatEndedPayload,
    gamePlaySocketService: GamePlaySocketService,
    combatSocketService: CombatSocketService,
): void {
    const currentPlayer = gamePlaySocketService.getCurrentPlayerCharacter();
    if (!currentPlayer || data.survivorId === undefined) {
        return;
    }

    if (currentPlayer.id !== data.survivorId) {
        return;
    }

    combatSocketService.showCombatNotification('Vous avez remporté le combat.');
}
