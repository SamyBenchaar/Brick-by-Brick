import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { CombatParticipants } from '@app/services/game-session/combat/combat-types';
import { COMBAT_POSTURE } from '@common/combat';
import { CombatEvents } from '@common/game.events';
import { Socket } from 'socket.io';
import { createCombatHandlerHarness, createPlayer, createSession, DEFAULT_LIFE } from './game-play-combat.handler.spec-utils';

/**
 * Strategie de test:
 * - Couvre les entrees de combat (requestCombat) et choix de posture.
 * - Verifie tous les early-return critiques.
 * Cas limites couverts:
 * - Session absente, combat indisponible, validation refusee.
 * - Posture recue sans session/combat/joueur.
 */
describe('GamePlayCombatHandler - request/posture', () => {
    it('devrait demarrer un combat valide, consommer une action et emettre CombatStarted', () => {
        const harness = createCombatHandlerHarness();
        const session = createSession(harness.attacker, harness.defender);
        const participants: CombatParticipants = {
            attacker: harness.attacker,
            defender: harness.defender,
            requestingPlayer: createPlayer('socket-1', harness.attacker),
        };

        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        harness.getCombatParticipantsFromRequestSpy.mockReturnValue(participants);

        harness.handler.handleRequestCombat(
            { id: 'socket-1' } as unknown as Socket,
            { roomId: 'ROOM1', defenderId: 'defender' },
            harness.context,
        );

        expect(harness.attacker.remainingActions).toBe(0);
        expect(session.activeCombat?.attackerId).toBe('attacker');
        expect(harness.pauseTurnTimerSpy).toHaveBeenCalledWith('ROOM1');
        expect(harness.serverToSpy).toHaveBeenCalledWith('ROOM1');
        expect(harness.roomEmitSpy).toHaveBeenCalledWith(
            CombatEvents.CombatStarted,
            expect.objectContaining({
                attackerId: 'attacker',
                defenderId: 'defender',
                roundNumber: 1,
            }),
        );
        expect(harness.context.logService.log).toHaveBeenCalledWith(
            'ROOM1',
            'Début de combat: Attacker attaque Defender',
        );
    });

    it('ne devrait rien faire si la session est introuvable lors de la demande de combat', () => {
        const harness = createCombatHandlerHarness();
        harness.getGameSessionSpy.mockReturnValue(undefined);

        harness.handler.handleRequestCombat(
            { id: 'socket-1' } as unknown as Socket,
            { roomId: 'ROOM1', defenderId: 'defender' },
            harness.context,
        );

        expect(harness.getCombatParticipantsFromRequestSpy).not.toHaveBeenCalled();
        expect(harness.roomEmitSpy).not.toHaveBeenCalled();
        expect(harness.context.logService.log).not.toHaveBeenCalled();
    });

    it('ne devrait rien faire si le combat est indisponible', () => {
        const harness = createCombatHandlerHarness();
        const session = createSession(harness.attacker, harness.defender);
        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        harness.isCombatUnavailableSpy.mockReturnValue(true);

        harness.handler.handleRequestCombat(
            { id: 'socket-1' } as unknown as Socket,
            { roomId: 'ROOM1', defenderId: 'defender' },
            harness.context,
        );

        expect(harness.getCombatParticipantsFromRequestSpy).not.toHaveBeenCalled();
        expect(harness.roomEmitSpy).not.toHaveBeenCalled();
    });

    it('ne devrait rien faire si la validation refuse le combat', () => {
        const harness = createCombatHandlerHarness();
        const session = createSession(harness.attacker, harness.defender);
        const participants: CombatParticipants = {
            attacker: harness.attacker,
            defender: harness.defender,
            requestingPlayer: createPlayer('socket-1', harness.attacker),
        };

        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        harness.getCombatParticipantsFromRequestSpy.mockReturnValue(participants);
        harness.canStartCombatSpy.mockReturnValue(false);

        harness.handler.handleRequestCombat(
            { id: 'socket-1' } as unknown as Socket,
            { roomId: 'ROOM1', defenderId: 'defender' },
            harness.context,
        );

        expect(session.activeCombat).toBeNull();
        expect(harness.roomEmitSpy).not.toHaveBeenCalled();
        expect(harness.context.logService.log).not.toHaveBeenCalled();
    });

    it('devrait enregistrer la posture de l attaquant sans resoudre tant que l autre posture manque', () => {
        const harness = createCombatHandlerHarness();
        const session = createSession(harness.attacker, harness.defender);
        session.activeCombat = {
            attackerId: 'attacker',
            defenderId: 'defender',
            initiatorId: 'attacker',
            roundNumber: 1,
            attackerHp: DEFAULT_LIFE,
            defenderHp: DEFAULT_LIFE,
        };

        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);

        const resolveCombatRoundSpy = jest
            .spyOn(
                harness.handler as unknown as {
                    resolveCombatRound: (gameSession: GameSession, handlerContext: GamePlayHandlerContext) => void;
                },
                'resolveCombatRound',
            )
            .mockImplementation(() => undefined);

        harness.handler.handlePostureChosen(
            { id: 'socket-1' } as unknown as Socket,
            { roomId: 'ROOM1', posture: COMBAT_POSTURE.OFFENSIVE },
            harness.context,
        );

        expect(session.activeCombat.attackerPosture).toBe(COMBAT_POSTURE.OFFENSIVE);
        expect(harness.stopCombatTimerSpy).not.toHaveBeenCalled();
        expect(resolveCombatRoundSpy).not.toHaveBeenCalled();
    });

    it('ne devrait rien faire sur choix de posture si session, combat ou joueur est introuvable', () => {
        const harness = createCombatHandlerHarness();

        harness.handler.handlePostureChosen(
            { id: 'socket-1' } as unknown as Socket,
            { roomId: 'ROOM1', posture: COMBAT_POSTURE.OFFENSIVE },
            harness.context,
        );

        const session = createSession(harness.attacker, harness.defender);
        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);

        harness.handler.handlePostureChosen(
            { id: 'socket-inconnu' } as unknown as Socket,
            { roomId: 'ROOM1', posture: COMBAT_POSTURE.OFFENSIVE },
            harness.context,
        );

        expect(harness.stopCombatTimerSpy).not.toHaveBeenCalled();
        expect(harness.roomEmitSpy).not.toHaveBeenCalled();
    });

    it('devrait arreter le timer et resoudre le round quand les deux postures sont choisies', () => {
        const harness = createCombatHandlerHarness();
        const session = createSession(harness.attacker, harness.defender);
        session.activeCombat = {
            attackerId: 'attacker',
            defenderId: 'defender',
            initiatorId: 'attacker',
            roundNumber: 1,
            attackerPosture: COMBAT_POSTURE.OFFENSIVE,
            attackerHp: DEFAULT_LIFE,
            defenderHp: DEFAULT_LIFE,
        };

        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);

        const resolveCombatRoundSpy = jest
            .spyOn(
                harness.handler as unknown as {
                    resolveCombatRound: (gameSession: GameSession, handlerContext: GamePlayHandlerContext) => void;
                },
                'resolveCombatRound',
            )
            .mockImplementation(() => undefined);

        harness.handler.handlePostureChosen(
            { id: 'socket-2' } as unknown as Socket,
            { roomId: 'ROOM1', posture: COMBAT_POSTURE.DEFENSIVE },
            harness.context,
        );

        expect(session.activeCombat.defenderPosture).toBe(COMBAT_POSTURE.DEFENSIVE);
        expect(harness.stopCombatTimerSpy).toHaveBeenCalledWith('ROOM1');
        expect(resolveCombatRoundSpy).toHaveBeenCalledWith(session, harness.context);
    });
});
