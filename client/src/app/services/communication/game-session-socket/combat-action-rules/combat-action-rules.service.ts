import { Injectable } from '@angular/core';
import { GameSession } from '@app/interfaces/game-session';
import { Character } from '@common/character';
import { GameModeValue } from '@common/constants/game-config-constants';
import { Player } from '@common/player';
import { Position } from '@common/position';

@Injectable({
    providedIn: 'root',
})
export class CombatActionRulesService {
    canCurrentPlayerAct(
        currentPlayer: Character | null,
        isMyTurn: boolean,
        hasActiveCombat: boolean,
    ): boolean {
        return isMyTurn && (currentPlayer?.remainingActions ?? 0) > 0 && !hasActiveCombat;
    }

    getAutoAttackTarget(session: GameSession | null, currentPlayer: Character | null): Character | null {
        if (!session || !currentPlayer?.position) {
            return null;
        }

        return (
            session.players
                .map((player: Player) => player.character)
                .find((target: Character) => this.canCharacterAttackTarget(session, currentPlayer, target)) ?? null
        );
    }

    canCharacterAttackTarget(
        session: GameSession | null,
        currentPlayer: Character | null,
        target: Character | null,
    ): boolean {
        if (!session || !currentPlayer || !target) {
            return false;
        }

        const hasAction = (currentPlayer.remainingActions ?? 0) > 0;
        const currentPlayerPosition = currentPlayer.position;
        const targetPosition = target.position;
        const isDifferentCharacter = currentPlayer.id !== target.id;

        const invalidActionDist = !hasAction || !currentPlayerPosition;
        const invalidTargetChar = !targetPosition || !isDifferentCharacter;

        if (invalidActionDist || invalidTargetChar) {
            return false;
        }

        return this.areAdjacent(currentPlayerPosition, targetPosition)
            && this.isEnemyTarget(session, currentPlayer, target);
    }

    private isEnemyTarget(session: GameSession, currentPlayer: Character, target: Character): boolean {
        if (session.gameMode !== GameModeValue.Ctf) {
            return true;
        }

        if (!currentPlayer.team || !target.team) {
            return true;
        }

        return currentPlayer.team !== target.team;
    }

    private areAdjacent(positionA: Position, positionB: Position): boolean {
        return Math.abs(positionA.x - positionB.x) + Math.abs(positionA.y - positionB.y) === 1;
    }
}
