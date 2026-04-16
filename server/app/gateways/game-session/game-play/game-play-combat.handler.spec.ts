import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/interfaces/game-play-handler';
import { CombatEndState, CombatParticipants, CombatRoundDetails } from '@app/services/game-session/combat/combat-types';
import { CombatOutcome, CombatPosture, CombatRoundResolvedPayload } from '@common/combat';
import { CombatEvents } from '@common/game.events';
import { Position } from '@common/position';
import { Socket } from 'socket.io';
import {
    createCombatHandlerHarness,
    createPlayer,
    createSession,
    DEFAULT_ATTACK,
    DEFAULT_DEFENSE,
    DEFAULT_LIFE,
} from './game-play-combat.handler.spec-utils';

const EXPECTED_COMBAT_TURN_TIME = 10;

/**
 * Strategie de test (Gateway WS + logique serveur):
 * Use cases vises:
 * - Demarrage d'un combat valide via socket (requestCombat) avec emission des evenements attendus.
 * - Choix de posture via socket et resolution de round quand les deux choix sont disponibles.
 * - Resolution complete d'un combat: round suivant, fin de combat, reprise ou fin de tour.
 *
 * Mocks / Stubs / Spies:
 * - Mocks des dependances de service pour isoler GamePlayCombatHandler de la logique interne des autres services.
 * - Stubs de session et de contexte pour controler les etats (combat actif, joueur courant, timer).
 * - Spies sur emissions socket, timers et appels de services pour verifier les interactions et effets de bord.
 *
 * Cas limites couverts et raison:
 * - Session absente, combat indisponible, validation refusee: evite les side effects quand la requete est invalide.
 * - Posture recue sans session/combat/joueur: garantit un comportement defensif sur donnees WS incompletes.
 * - Aucun choix de posture avant timeout: confirme la robustesse du flux asynchrone et la resolution automatique.
 * - turnShouldContinue=true sans joueur actif: protege contre un etat incoherent et force une fin de tour sure.
 */
describe('GamePlayCombatHandler', () => {
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
        expect(session.setCurrentCombatTurnTime).toHaveBeenCalledWith(EXPECTED_COMBAT_TURN_TIME);
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

    it('devrait reprendre ou terminer le tour apres un combat resolu selon turnShouldContinue', () => {
        const harness = createCombatHandlerHarness();
        const session = createSession(harness.attacker, harness.defender);
        session.activeCombat = {
            attackerId: 'attacker',
            defenderId: 'defender',
            initiatorId: 'attacker',
            roundNumber: 1,
            attackerPosture: CombatPosture.OFFENSIVE,
            defenderPosture: CombatPosture.DEFENSIVE,
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
            attackerChoice: CombatPosture.OFFENSIVE,
            defenderChoice: CombatPosture.DEFENSIVE,
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
            outcome: CombatOutcome.ATTACKER,
            attackerPosition: harness.attacker.position as Position,
            defenderPosition: { x: 5, y: 5 },
            turnShouldContinue: false,
        };

        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        harness.buildRoundDetailsSpy.mockReturnValue(roundDetails);
        harness.buildRoundResolvedPayloadSpy.mockReturnValue(roundPayload);
        harness.determineRoundWinnerSpy.mockReturnValue('attacker');
        harness.getCombatOutcomeSpy.mockReturnValue(CombatOutcome.ATTACKER);
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
            attackerPosture: CombatPosture.OFFENSIVE,
            defenderPosture: CombatPosture.DEFENSIVE,
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
            attackerChoice: CombatPosture.OFFENSIVE,
            defenderChoice: CombatPosture.DEFENSIVE,
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

    it('devrait reprendre le timer de tour si le vainqueur peut continuer et reste le joueur actif', () => {
        const harness = createCombatHandlerHarness();
        const session = createSession(harness.attacker, harness.defender);
        session.activeCombat = {
            attackerId: 'attacker',
            defenderId: 'defender',
            initiatorId: 'attacker',
            roundNumber: 3,
            attackerPosture: CombatPosture.OFFENSIVE,
            defenderPosture: CombatPosture.DEFENSIVE,
            attackerHp: DEFAULT_LIFE,
            defenderHp: 1,
        };

        const roundDetails: CombatRoundDetails = {
            attackerAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 2, dice: 4, tilePenalty: 0, total: 10 },
            attackerDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
            defenderAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
            defenderDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 2, dice: 1, tilePenalty: 0, total: 7 },
            damageToAttacker: 0,
            damageToDefender: 1,
        };

        const roundPayload: CombatRoundResolvedPayload = {
            roundNumber: 3,
            attackerId: 'attacker',
            defenderId: 'defender',
            attackerChoice: CombatPosture.OFFENSIVE,
            defenderChoice: CombatPosture.DEFENSIVE,
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
            outcome: CombatOutcome.ATTACKER,
            attackerPosition: harness.attacker.position as Position,
            defenderPosition: { x: 5, y: 5 },
            turnShouldContinue: true,
        };

        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        harness.buildRoundDetailsSpy.mockReturnValue(roundDetails);
        harness.buildRoundResolvedPayloadSpy.mockReturnValue(roundPayload);
        harness.determineRoundWinnerSpy.mockReturnValue(CombatOutcome.ATTACKER);
        harness.getCombatOutcomeSpy.mockReturnValue(CombatOutcome.ATTACKER);
        harness.buildCombatEndStateSpy.mockReturnValue(combatEndState);

        (
            harness.handler as unknown as {
                resolveCombatRound: (gameSession: GameSession, handlerContext: GamePlayHandlerContext) => void;
            }
        ).resolveCombatRound(session as unknown as GameSession, harness.context);

        expect(harness.resumeTurnTimerSpy).toHaveBeenCalled();
        expect(harness.endCurrentTurnSpy).not.toHaveBeenCalled();
        expect(harness.context.onTurnEnd).not.toHaveBeenCalled();
    });

    it('devrait terminer le tour si aucun joueur actif n est disponible meme si turnShouldContinue=true', () => {
        const harness = createCombatHandlerHarness();
        const session = createSession(harness.attacker, harness.defender);
        session.getCurrentPlayer = jest.fn(() => undefined);
        session.activeCombat = {
            attackerId: 'attacker',
            defenderId: 'defender',
            initiatorId: 'attacker',
            roundNumber: 4,
            attackerPosture: CombatPosture.OFFENSIVE,
            defenderPosture: CombatPosture.DEFENSIVE,
            attackerHp: DEFAULT_LIFE,
            defenderHp: 1,
        };

        const roundDetails: CombatRoundDetails = {
            attackerAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 2, dice: 4, tilePenalty: 0, total: 10 },
            attackerDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
            defenderAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
            defenderDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 2, dice: 1, tilePenalty: 0, total: 7 },
            damageToAttacker: 0,
            damageToDefender: 1,
        };

        const roundPayload: CombatRoundResolvedPayload = {
            roundNumber: 4,
            attackerId: 'attacker',
            defenderId: 'defender',
            attackerChoice: CombatPosture.OFFENSIVE,
            defenderChoice: CombatPosture.DEFENSIVE,
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
            outcome: CombatOutcome.ATTACKER,
            attackerPosition: harness.attacker.position as Position,
            defenderPosition: { x: 5, y: 5 },
            turnShouldContinue: true,
        };

        harness.getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        harness.buildRoundDetailsSpy.mockReturnValue(roundDetails);
        harness.buildRoundResolvedPayloadSpy.mockReturnValue(roundPayload);
        harness.determineRoundWinnerSpy.mockReturnValue(CombatOutcome.ATTACKER);
        harness.getCombatOutcomeSpy.mockReturnValue(CombatOutcome.ATTACKER);
        harness.buildCombatEndStateSpy.mockReturnValue(combatEndState);

        (
            harness.handler as unknown as {
                resolveCombatRound: (gameSession: GameSession, handlerContext: GamePlayHandlerContext) => void;
            }
        ).resolveCombatRound(session as unknown as GameSession, harness.context);

        expect(harness.resumeTurnTimerSpy).not.toHaveBeenCalled();
        expect(harness.endCurrentTurnSpy).toHaveBeenCalledWith(session);
        expect(harness.context.onTurnEnd).toHaveBeenCalledWith(session);
    });
});
