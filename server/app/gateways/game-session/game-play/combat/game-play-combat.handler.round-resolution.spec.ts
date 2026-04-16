import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { CombatEndState, CombatRoundDetails } from '@app/services/game-session/combat/combat-types';
import { COMBAT_POSTURE, CombatRoundResolvedPayload } from '@common/combat';
import { CombatEvents } from '@common/game.events';
import { Position } from '@common/position';
import {
    createCombatHandlerHarness,
    createSession,
    DEFAULT_ATTACK,
    DEFAULT_DEFENSE,
    DEFAULT_LIFE,
} from './game-play-combat.handler.spec-utils';

/**
 * Strategie de test:
 * - Couvre la resolution d'un round jusqu'a la fin de combat.
 * - Couvre la branche de continuation de combat (round suivant).
 * Cas limites couverts:
 * - turnShouldContinue=false doit forcer la fin de tour.
 * - outcome=null doit emettre CombatRoundResolved puis relancer le timer.
 */
describe('GamePlayCombatHandler - round resolution', () => {
    it('devrait reprendre ou terminer le tour apres un combat resolu selon turnShouldContinue', () => {
        const harness = createCombatHandlerHarness();
        const session = createSession(harness.attacker, harness.defender);
        session.activeCombat = {
            attackerId: 'attacker',
            defenderId: 'defender',
            initiatorId: 'attacker',
            roundNumber: 1,
            attackerPosture: COMBAT_POSTURE.OFFENSIVE,
            defenderPosture: COMBAT_POSTURE.DEFENSIVE,
            attackerHp: DEFAULT_LIFE,
            defenderHp: 1,
        };

        const roundDetails: CombatRoundDetails = {
            attackerAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 2, dice: DEFAULT_ATTACK, tilePenalty: 0, total: 10 },
            attackerDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 0, dice: 2, tilePenalty: 0, total: DEFAULT_LIFE },
            defenderAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
            defenderDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 2, dice: 1, tilePenalty: 0, total: 7 },
            damageToAttacker: 0,
            damageToDefender: 1,
        };

        const roundPayload: CombatRoundResolvedPayload = {
            roundNumber: 1,
            attackerId: 'attacker',
            defenderId: 'defender',
            attackerChoice: COMBAT_POSTURE.OFFENSIVE,
            defenderChoice: COMBAT_POSTURE.DEFENSIVE,
            attackerStrike: {
                attack: roundDetails.attackerAttackDetail,
                defense: roundDetails.defenderDefenseDetail,
                damage: 1,
            },
            defenderStrike: {
                attack: roundDetails.defenderAttackDetail,
                defense: roundDetails.attackerDefenseDetail,
                damage: 0,
            },
            attackerLife: DEFAULT_LIFE,
            defenderLife: 0,
        };

        const combatEndState: CombatEndState = {
            attacker: harness.attacker,
            defender: harness.defender,
            winner: harness.attacker,
            loserIds: ['defender'],
            outcome: 'attacker',
            attackerPosition: harness.attacker.position as Position,
            defenderPosition: { x: 5, y: 5 },
            turnShouldContinue: false,
        };

        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        harness.buildRoundDetailsSpy.mockReturnValue(roundDetails);
        harness.buildRoundResolvedPayloadSpy.mockReturnValue(roundPayload);
        harness.determineRoundWinnerSpy.mockReturnValue('attacker');
        harness.getCombatOutcomeSpy.mockReturnValue('attacker');
        harness.buildCombatEndStateSpy.mockReturnValue(combatEndState);

        (
            harness.handler as unknown as {
                resolveCombatRound: (gameSession: GameSession, handlerContext: GamePlayHandlerContext) => void;
            }
        ).resolveCombatRound(session as unknown as GameSession, harness.context);

        expect(harness.stopCombatTimerSpy).toHaveBeenCalledWith('ROOM1');
        expect(harness.buildCombatEndStateSpy).toHaveBeenCalled();
        expect(session.activeCombat).toBeNull();
        expect(harness.roomEmitSpy).toHaveBeenCalledWith(
            CombatEvents.CombatResult,
            expect.objectContaining({
                attackerId: 'attacker',
                defenderId: 'defender',
                winnerId: 'attacker',
            }),
        );
        expect(harness.endCurrentTurnSpy).toHaveBeenCalledWith(session);
        expect(harness.context.onTurnEnd).toHaveBeenCalledWith(session);
        expect(harness.context.emitReachableTiles).toHaveBeenCalledWith(session);
    });

    it('devrait emettre CombatRoundResolved et preparer le round suivant si le combat continue', () => {
        const harness = createCombatHandlerHarness();
        const session = createSession(harness.attacker, harness.defender);
        session.activeCombat = {
            attackerId: 'attacker',
            defenderId: 'defender',
            initiatorId: 'attacker',
            roundNumber: 2,
            attackerPosture: COMBAT_POSTURE.OFFENSIVE,
            defenderPosture: COMBAT_POSTURE.DEFENSIVE,
            attackerHp: DEFAULT_LIFE,
            defenderHp: DEFAULT_LIFE,
        };

        const roundDetails: CombatRoundDetails = {
            attackerAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 2, dice: 2, tilePenalty: 0, total: 8 },
            attackerDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 0, dice: 2, tilePenalty: 0, total: 6 },
            defenderAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 0, dice: 2, tilePenalty: 0, total: 6 },
            defenderDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 2, dice: 2, tilePenalty: 0, total: 8 },
            damageToAttacker: 0,
            damageToDefender: 0,
        };

        const roundPayload: CombatRoundResolvedPayload = {
            roundNumber: 2,
            attackerId: 'attacker',
            defenderId: 'defender',
            attackerChoice: COMBAT_POSTURE.OFFENSIVE,
            defenderChoice: COMBAT_POSTURE.DEFENSIVE,
            attackerStrike: {
                attack: roundDetails.attackerAttackDetail,
                defense: roundDetails.attackerDefenseDetail,
                damage: 0,
            },
            defenderStrike: {
                attack: roundDetails.defenderAttackDetail,
                defense: roundDetails.defenderDefenseDetail,
                damage: 0,
            },
            attackerLife: DEFAULT_LIFE,
            defenderLife: DEFAULT_LIFE,
        };

        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        harness.buildRoundDetailsSpy.mockReturnValue(roundDetails);
        harness.buildRoundResolvedPayloadSpy.mockReturnValue(roundPayload);
        harness.determineRoundWinnerSpy.mockReturnValue('draw');
        harness.getCombatOutcomeSpy.mockReturnValue(null);

        (
            harness.handler as unknown as {
                resolveCombatRound: (gameSession: GameSession, handlerContext: GamePlayHandlerContext) => void;
            }
        ).resolveCombatRound(session as unknown as GameSession, harness.context);

        expect(harness.prepareNextRoundSpy).toHaveBeenCalledWith(session.activeCombat);
        expect(harness.roomEmitSpy).toHaveBeenCalledWith(CombatEvents.CombatRoundResolved, roundPayload);
        expect(harness.startCombatTimerSpy).toHaveBeenCalled();
        expect(harness.endCurrentTurnSpy).not.toHaveBeenCalled();
    });
});
