import { GameSession } from '@app/domain/game-session';
import { BuildCombatEndStatePayload, LoserResolutionPayload } from '@app/interfaces/combat-payloads';
import { CombatEndState } from '@app/services/game-session/combat/combat-types';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { Character } from '@common/character';
import { CombatOutcome } from '@common/combat';
import { GameModeValue } from '@common/constants/game-config-constants';
import { TileType } from '@common/map';
import { Position } from '@common/position';
import { Inject, Injectable, forwardRef } from '@nestjs/common';

@Injectable()
export class CombatEndService {
    constructor(
        @Inject(forwardRef(() => GameSessionService))
        private readonly gameSessionService: GameSessionService,
    ) {}

    buildCombatEndState(payload: BuildCombatEndStatePayload): CombatEndState {
        const { gameSession, attacker, defender, combat, outcome } = payload;
        const attackerDefeated = outcome === CombatOutcome.DEFENDER || outcome === CombatOutcome.DRAW;
        const defenderDefeated = outcome === CombatOutcome.ATTACKER || outcome === CombatOutcome.DRAW;
        const winner = this.getWinnerFromOutcome(outcome, attacker, defender);

        if (!attackerDefeated) {
            attacker.life = combat.attackerHp;
        }

        if (!defenderDefeated) {
            defender.life = combat.defenderHp;
        }

        if (winner) {
            winner.victories = (winner.victories ?? 0) + 1;
        }

        if (attackerDefeated) attacker.defeats = (attacker.defeats ?? 0) + 1;
        if (defenderDefeated) defender.defeats = (defender.defeats ?? 0) + 1;

        const attackerPosition = attackerDefeated
            ? this.respawnDefeatedPlayer(gameSession, attacker)
            : attacker.position;

        const defenderPosition = defenderDefeated
            ? this.respawnDefeatedPlayer(gameSession, defender)
            : defender.position;

        const turnShouldContinue = outcome === CombatOutcome.ATTACKER && (attacker.remainingMovement ?? 0) > 0;

        return {
            attacker,
            defender,
            winner,
            loserIds: this.getLoserIds({
                attacker,
                defender,
                attackerDefeated,
                defenderDefeated,
            }),
            outcome,
            attackerPosition,
            defenderPosition,
            turnShouldContinue,
        };
    }

    private getWinnerFromOutcome(
        outcome: CombatOutcome,
        attacker: Character,
        defender: Character,
    ): Character | null {
        if (outcome === CombatOutcome.ATTACKER) {
            return attacker;
        }

        if (outcome === CombatOutcome.DEFENDER) {
            return defender;
        }

        return null;
    }

    private getLoserIds(payload: LoserResolutionPayload): string[] {
        const { attacker, defender, attackerDefeated, defenderDefeated } = payload;
        const loserIds: string[] = [];

        if (attackerDefeated) {
            loserIds.push(attacker.id);
        }

        if (defenderDefeated) {
            loserIds.push(defender.id);
        }

        return loserIds;
    }

    private respawnDefeatedPlayer(gameSession: GameSession, player: Character): Position {
        const defeatPosition = { ...player.position };

        this.dropFlagIfNeeded(gameSession, player, defeatPosition);

        const respawnPosition = this.getRespawnPosition(gameSession, player);
        player.position = respawnPosition;
        player.life = player.maxLife;

        return respawnPosition;
    }

    private dropFlagIfNeeded(gameSession: GameSession, player: Character, defeatPosition: Position): void {
        if (!player.hasFlag || gameSession.gameMode !== GameModeValue.Ctf) {
            return;
        }

        const dropPosition = this.getFlagDropPosition(gameSession, defeatPosition);
        if (dropPosition) {
            gameSession.dropFlag(dropPosition);
        }
    }

    private getRespawnPosition(gameSession: GameSession, player: Character): Position {
        const startingPoint = gameSession.getStartingPoint(player.id);
        if (!startingPoint) {
            return player.position;
        }

        const startingPointIsFree = this.isPositionFree(gameSession, startingPoint, player.id);
        if (startingPointIsFree) {
            return startingPoint;
        }

        return this.gameSessionService.findNearestFreeTile(gameSession, startingPoint) ?? startingPoint;
    }

    private isPositionFree(gameSession: GameSession, position: Position, excludedPlayerId: string): boolean {
        return !gameSession.players.some((otherPlayer) =>
            otherPlayer.character.id !== excludedPlayerId &&
            otherPlayer.character.position.x === position.x &&
            otherPlayer.character.position.y === position.y,
        );
    }

    private getFlagDropPosition(gameSession: GameSession, defeatPosition: Position): Position | null {
        const tile = gameSession.getMapCopy()?.tiles?.[defeatPosition.y]?.[defeatPosition.x];
        if (!tile) {
            return null;
        }

        const defeatedOnOpenedDoor = tile.type === TileType.Door && tile.doorState === 'opened';
        if (defeatedOnOpenedDoor) {
            return this.gameSessionService.findNearestFreeTile(gameSession, defeatPosition);
        }

        return defeatPosition;
    }
}
