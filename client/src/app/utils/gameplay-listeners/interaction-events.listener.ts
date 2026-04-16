import {
    InteractResultPayload,
} from '@app/interfaces/game-play';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { SANCTUARY_COOLDOWN_TURNS } from '@common/constants/santuary-constants';
import { GameSessionEvents } from '@common/game.events';
import { ObjectType } from '@common/map';
import { findSanctuaryOrigin } from './gameplay-listeners.shared';

export function registerInteractionEventListeners(
    socketService: SocketService,
    gamePlaySocketService: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
): void {
    socketService.on<InteractResultPayload>(GameSessionEvents.InteractResult, (data) => {
        updateMapAfterInteraction(data, gamePlaySocketService);
        updateCurrentPlayerAfterInteraction(data, gamePlaySocketService, gameSessionSocketService);
    });
}

function updateMapAfterInteraction(
    data: InteractResultPayload,
    gamePlaySocketService: GamePlaySocketService,
): void {
    const currentMap = gamePlaySocketService.mapCopy();
    if (!currentMap) {
        return;
    }

    if (data.interactionType === 'door') {
        currentMap.mapConfig.tiles[data.position.y][data.position.x].doorState = data.newDoorState;
        gamePlaySocketService.mapCopy.set({ ...currentMap });
        return;
    }

    const isSanctuaryInteraction =
        data.interactionType === ObjectType.HealingSanctuary
        || data.interactionType === ObjectType.CombatSanctuary;

    if (!isSanctuaryInteraction) {
        return;
    }

    const originPosition = findSanctuaryOrigin(data.position, currentMap.mapConfig.tiles);
    if (!originPosition) {
        return;
    }

    currentMap.mapConfig.tiles[originPosition.y][originPosition.x].sanctuaryCooldown = SANCTUARY_COOLDOWN_TURNS;
    gamePlaySocketService.mapCopy.set({ ...currentMap });
}

function updateCurrentPlayerAfterInteraction(
    data: InteractResultPayload,
    gamePlaySocketService: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
): void {
    const session = gameSessionSocketService.currentSession();
    if (!session) {
        return;
    }

    const currentPlayerId = gamePlaySocketService.currentPlayerTurn();
    const player = session.players.find((playerEntry) => playerEntry.character.id === currentPlayerId);
    if (!player) {
        return;
    }

    player.character.remainingActions = data.remainingActions;

    if (data.newLife) {
        player.character.life = data.newLife;
    }

    if (data.newAttack) {
        player.character.attack = data.newAttack;
    }

    if (data.newDefense) {
        player.character.defense = data.newDefense;
    }

    gameSessionSocketService.currentSession.set({ ...session });
}
