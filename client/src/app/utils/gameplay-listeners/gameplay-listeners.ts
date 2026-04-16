import { setupCombatListeners } from '@app/utils/gameplay-listeners/combat-listener';
import { handleCombatResult } from '@app/utils/gameplay-listeners/gameplay-listeners-helper.service';
import { CombatResultPayload } from '@common/combat';
import { CombatEvents } from '@common/game.events';
import { registerAbandonEventListeners } from './abandon-events.listener';
import { registerFlagTransferEventListeners } from './flag-transfer-events.listener';
import { registerGameEndEventListeners } from './game-end-events.listener';
import { GameplayListenersContext } from './gameplay-listeners.types';
import { registerInteractionEventListeners } from './interaction-events.listener';
import { registerSessionUpdateEventListeners } from './session-update-events.listener';
import { registerTurnEventListeners } from './turn-events.listener';

export function setupGameplayEventListeners(context: GameplayListenersContext): void {
    const {
        gamePlaySocketService,
        gameSessionSocketService,
        socketService,
        router,
        dialog,
        flagTransferService,
        combatSocketService,
    } = context;

    registerTurnEventListeners(
        socketService,
        gamePlaySocketService,
        gameSessionSocketService,
        dialog,
        flagTransferService,
    );

    setupCombatListeners(
        socketService,
        gamePlaySocketService,
        gameSessionSocketService,
        combatSocketService,
    );

    socketService.on<CombatResultPayload>(CombatEvents.CombatResult, (data) => {
        handleCombatResult(data, gamePlaySocketService, gameSessionSocketService, combatSocketService);
    });

    registerInteractionEventListeners(
        socketService,
        gamePlaySocketService,
        gameSessionSocketService,
    );

    registerAbandonEventListeners(
        socketService,
        gamePlaySocketService,
        gameSessionSocketService,
        combatSocketService,
    );

    registerGameEndEventListeners(
        socketService,
        gamePlaySocketService,
        gameSessionSocketService,
        router,
        dialog,
    );

    registerFlagTransferEventListeners(
        socketService,
        gamePlaySocketService,
        gameSessionSocketService,
        dialog,
        flagTransferService,
    );

    registerSessionUpdateEventListeners(
        socketService,
        gamePlaySocketService,
        gameSessionSocketService,
    );
}
