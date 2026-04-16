import { Injectable } from '@angular/core';
import { GameSession } from '@app/interfaces/game-session';
import { Character } from '@common/character';
import { GameModeValue } from '@common/constants/game-config-constants';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { FlagTransferStateService } from './flag-transfer-state.service';

@Injectable({
    providedIn: 'root',
})
export class FlagActionRulesService {
    constructor(private readonly flagTransferStateService: FlagTransferStateService) {}

    private isInvalidFlagActionState(
        session: GameSession | null,
        currentPlayer: Character | null,
        target: Character | null,
        canAct: boolean,
    ): boolean {
        const invalidModeOrPlayer = session?.gameMode !== GameModeValue.Ctf || !currentPlayer;
        const invalidTargetOrAct = !target || !canAct;
        return invalidModeOrPlayer || invalidTargetOrAct;
    }

    canTransferFlagTo(
        session: GameSession | null,
        currentPlayer: Character | null,
        target: Character | null,
        canAct: boolean,
    ): boolean {
        if (this.isInvalidFlagActionState(session, currentPlayer, target, canAct)) {
            return false;
        }

        if (this.flagTransferStateService.hasPendingTransfer(target!.id)) {
            return false;
        }

        const currentPlayerHasFlag = !!currentPlayer!.hasFlag;
        const targetHasFlag = !!target!.hasFlag;
        const hasCompatibleFlagState = currentPlayerHasFlag !== targetHasFlag;

        return hasCompatibleFlagState && this.isValidFlagTransferTarget(currentPlayer!, target!);
    }

    canRequestFlagFrom(
        session: GameSession | null,
        currentPlayer: Character | null,
        target: Character | null,
        canAct: boolean,
    ): boolean {
        if (this.isInvalidFlagActionState(session, currentPlayer, target, canAct)) {
            return false;
        }

        if (this.flagTransferStateService.hasPendingTransfer(target!.id)) {
            return false;
        }

        const hasCompatibleFlagState = !currentPlayer!.hasFlag && !!target!.hasFlag;

        return hasCompatibleFlagState && this.isValidFlagTransferTarget(currentPlayer!, target!);
    }

    canPlayerInteractFlag(
        session: GameSession | null,
        currentPlayer: Character | null,
        canAct: boolean,
    ): boolean {
        if (!session || !currentPlayer || !canAct) {
            return false;
        }

        return session.players.some((player: Player) => {
            const targetCharacter = player.character;
            if (targetCharacter.id === currentPlayer.id) {
                return false;
            }

            return this.canTransferFlagTo(session, currentPlayer, targetCharacter, canAct)
                || this.canRequestFlagFrom(session, currentPlayer, targetCharacter, canAct);
        });
    }

    private isValidFlagTransferTarget(currentPlayer: Character, target: Character): boolean {
        if (!currentPlayer.position || !target.position) {
            return false;
        }

        if (target.id === currentPlayer.id || currentPlayer.team !== target.team) {
            return false;
        }

        return this.areAdjacent(currentPlayer.position, target.position);
    }

    private areAdjacent(positionA: Position, positionB: Position): boolean {
        return Math.abs(positionA.x - positionB.x) + Math.abs(positionA.y - positionB.y) === 1;
    }
}
