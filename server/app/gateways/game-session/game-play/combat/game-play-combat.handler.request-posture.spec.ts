import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/interfaces/game-play-handler';
import { CombatParticipants } from '@app/services/game-session/combat/combat-types';
import { CombatPosture } from '@common/combat';
import { CombatEvents } from '@common/game.events';
import { Socket } from 'socket.io';
import { createCombatHandlerHarness, createPlayer, createSession, DEFAULT_LIFE } from '../game-play-combat.handler.spec-utils';

/**
 * Strategie de test:
 * - Couvre les entrees de combat (requestCombat), le demarrage du timer de round (10s) et les choix de posture.
 * - Verifie les early-return critiques et la resolution anticipee d'un round quand les deux joueurs choisissent avant timeout.
 * Cas limites couverts:
 * - Session absente, combat indisponible, validation refusee.
 * - Posture recue sans session/combat/joueur.
 * - Aucun choix de posture avant timeout: round resolu automatiquement.
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
        expect(session.setCurrentCombatTurnTime).toHaveBeenCalledWith(10);
        expect(harness.startCombatTimerSpy).toHaveBeenCalled();
    });

    it('devrait resoudre automatiquement le round au timeout quand aucun joueur ne choisit de posture', () => {
        const harness = createCombatHandlerHarness();
        const session = createSession(harness.attacker, harness.defender);
        const participants: CombatParticipants = {
            attacker: harness.attacker,
            defender: harness.defender,
            requestingPlayer: createPlayer('socket-1', harness.attacker),
        };

        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        harness.getCombatParticipantsFromRequestSpy.mockReturnValue(participants);

        const resolveCombatRoundSpy = jest
            .spyOn(
                harness.handler as unknown as {
                    resolveCombatRound: (gameSession: GameSession, handlerContext: GamePlayHandlerContext) => void;
                },
                'resolveCombatRound',
            )
            .mockImplementation(() => undefined);

        harness.handler.handleRequestCombat(
            { id: 'socket-1' } as unknown as Socket,
            { roomId: 'ROOM1', defenderId: 'defender' },
            harness.context,
        );

        const [, timeoutCallback] = harness.startCombatTimerSpy.mock.calls[0] as [
            GameSession,
            () => void,
            (timeRemaining: number) => void,
        ];
        timeoutCallback();

        expect(resolveCombatRoundSpy).toHaveBeenCalledWith(session, harness.context);
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
            { roomId: 'ROOM1', posture: CombatPosture.OFFENSIVE },
            harness.context,
        );

        expect(session.activeCombat.attackerPosture).toBe(CombatPosture.OFFENSIVE);
        expect(harness.stopCombatTimerSpy).not.toHaveBeenCalled();
        expect(resolveCombatRoundSpy).not.toHaveBeenCalled();
    });

    it('ne devrait rien faire sur choix de posture si session, combat ou joueur est introuvable', () => {
        const harness = createCombatHandlerHarness();

        harness.handler.handlePostureChosen(
            { id: 'socket-1' } as unknown as Socket,
            { roomId: 'ROOM1', posture: CombatPosture.OFFENSIVE },
            harness.context,
        );

        const session = createSession(harness.attacker, harness.defender);
        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);

        harness.handler.handlePostureChosen(
            { id: 'socket-inconnu' } as unknown as Socket,
            { roomId: 'ROOM1', posture: CombatPosture.OFFENSIVE },
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
            attackerPosture: CombatPosture.OFFENSIVE,
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
            { roomId: 'ROOM1', posture: CombatPosture.DEFENSIVE },
            harness.context,
        );

        expect(session.activeCombat.defenderPosture).toBe(CombatPosture.DEFENSIVE);
        expect(harness.stopCombatTimerSpy).toHaveBeenCalledWith('ROOM1');
        expect(resolveCombatRoundSpy).toHaveBeenCalledWith(session, harness.context);
    });
});
