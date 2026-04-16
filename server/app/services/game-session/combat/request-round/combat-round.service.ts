import { GameSession } from '@app/domain/game-session';
import { ApplyRoundDamagePayload, BuildRoundDetailsPayload, CombatScorePayload } from '@app/interfaces/combat-payloads';
import { CombatRoundDetails } from '@app/services/game-session/combat/combat-types';
import { Character } from '@common/character';
import { ActiveCombat, CombatOutcome, CombatPosture, CombatRoundResolvedPayload, CombatValueDetail } from '@common/combat';
import { Dice, DICE_FACES_MAP } from '@common/dice';
import { TileType } from '@common/map';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CombatRoundService {
    private readonly iceTilePenalty = -2;

    buildRoundDetails(payload: BuildRoundDetailsPayload): CombatRoundDetails {
        const { gameSession, combat, attacker, defender } = payload;
        const attackerAttackDetail = this.calculateCombatScore({ gameSession, character: attacker, combat, isAttackMode: true, isAttacker: true });
        const attackerDefenseDetail = this.calculateCombatScore({ gameSession, character: attacker, combat, isAttackMode: false, isAttacker: true });
        const defenderAttackDetail = this.calculateCombatScore({ gameSession, character: defender, combat, isAttackMode: true, isAttacker: false });
        const defenderDefenseDetail = this.calculateCombatScore({ gameSession, character: defender, combat, isAttackMode: false, isAttacker: false });

        const damageToDefender = Math.max(attackerAttackDetail.total - defenderDefenseDetail.total, 0);
        const damageToAttacker = Math.max(defenderAttackDetail.total - attackerDefenseDetail.total, 0);

        return {
            attackerAttackDetail,
            attackerDefenseDetail,
            defenderAttackDetail,
            defenderDefenseDetail,
            damageToDefender,
            damageToAttacker,
        };
    }

    applyRoundDamage(payload: ApplyRoundDamagePayload): void {
        const { combat, roundDetails, attacker, defender } = payload;
        const effectiveDamageToDefender = Math.min(roundDetails.damageToDefender, combat.defenderHp);
        const effectiveDamageToAttacker = Math.min(roundDetails.damageToAttacker, combat.attackerHp);

        combat.attackerHp = Math.max(combat.attackerHp - roundDetails.damageToAttacker, 0);
        combat.defenderHp = Math.max(combat.defenderHp - roundDetails.damageToDefender, 0);

        attacker.totalDamageDealt += effectiveDamageToDefender;
        attacker.totalDamageReceived += effectiveDamageToAttacker;
        defender.totalDamageDealt += effectiveDamageToAttacker;
        defender.totalDamageReceived += effectiveDamageToDefender;
    }

    buildRoundResolvedPayload(
        combat: ActiveCombat,
        roundDetails: CombatRoundDetails,
    ): CombatRoundResolvedPayload {
        return {
            roundNumber: combat.roundNumber,
            attackerId: combat.attackerId,
            defenderId: combat.defenderId,
            attackerChoice: combat.attackerPosture || CombatPosture.NONE,
            defenderChoice: combat.defenderPosture || CombatPosture.NONE,
            attackerStrike: {
                attack: roundDetails.attackerAttackDetail,
                defense: roundDetails.attackerDefenseDetail,
                damage: roundDetails.damageToDefender,
            },
            defenderStrike: {
                attack: roundDetails.defenderAttackDetail,
                defense: roundDetails.defenderDefenseDetail,
                damage: roundDetails.damageToAttacker,
            },
            attackerLife: combat.attackerHp,
            defenderLife: combat.defenderHp,
        };
    }

    getCombatOutcome(combat: ActiveCombat): CombatOutcome | null {
        const attackerDefeated = combat.attackerHp === 0;
        const defenderDefeated = combat.defenderHp === 0;

        if (attackerDefeated && defenderDefeated) {
            return CombatOutcome.DRAW;
        }

        if (defenderDefeated) {
            return CombatOutcome.ATTACKER;
        }

        if (attackerDefeated) {
            return CombatOutcome.DEFENDER;
        }

        return null;
    }

    determineRoundWinner(damageToAttacker: number, damageToDefender: number): CombatOutcome {
        if (damageToDefender > damageToAttacker) {
            return CombatOutcome.ATTACKER;
        }

        if (damageToAttacker > damageToDefender) {
            return CombatOutcome.DEFENDER;
        }

        return CombatOutcome.DRAW;
    }

    prepareNextRound(combat: ActiveCombat): void {
        combat.roundNumber += 1;
        combat.attackerPosture = undefined;
        combat.defenderPosture = undefined;
    }

    private calculateCombatScore(payload: CombatScorePayload): CombatValueDetail {
        const { gameSession, character, combat, isAttackMode, isAttacker } = payload;
        const posture = isAttacker ? combat.attackerPosture : combat.defenderPosture;
        const attackBonus = posture === CombatPosture.OFFENSIVE ? 2 : 0;
        const defenseBonus = posture === CombatPosture.DEFENSIVE ? 2 : 0;

        const baseStat = isAttackMode ? character.attack : character.defense;
        const postureBonus = isAttackMode ? attackBonus : defenseBonus;
        const tilePenalty = this.getTilePenalty(gameSession, character);

        const diceRoll = isAttackMode
            ? this.rollDice(character.attackDice, isAttacker, gameSession.isDebugModeActivated)
            : this.rollDice(character.defenseDice, isAttacker, gameSession.isDebugModeActivated);

        const total = baseStat + postureBonus + tilePenalty + diceRoll;

        return {
            base: baseStat,
            postureBonus,
            dice: diceRoll,
            tilePenalty,
            total,
        };
    }

    private getTilePenalty(gameSession: GameSession, player: Character): number {
        const tile = gameSession.getMapCopy()?.tiles?.[player.position.y]?.[player.position.x];
        if (!tile) {
            return 0;
        }

        return tile.type === TileType.Ice ? this.iceTilePenalty : 0;
    }

    private rollDice(dice: Dice, isAttacker: boolean, debugMode = false): number {
        if (debugMode) {
            return isAttacker ? DICE_FACES_MAP[dice] : 1;
        }

        const faces = DICE_FACES_MAP[dice];
        return Math.floor(Math.random() * faces) + 1;
    }
}
