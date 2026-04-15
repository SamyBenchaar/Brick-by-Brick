import { GameSession } from '@app/domain/game-session';
import { GamePlayCombatHandler } from './game-play-combat.handler';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { CombatEndService } from '@app/services/game-session/combat/combat-end.service';
import { CombatRequestValidatorService } from '@app/services/game-session/combat/combat-request-validator.service';
import { CombatRoundService } from '@app/services/game-session/combat/combat-round.service';
import { CombatEndState, CombatParticipants, CombatRoundDetails } from '@app/services/game-session/combat/combat-types';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { Character } from '@common/character';
import { ActiveCombat, COMBAT_POSTURE, CombatRoundResolvedPayload } from '@common/combat';
import { CombatEvents } from '@common/game.events';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { Dice } from '@common/dice';
import { Server, Socket } from 'socket.io';

const DEFAULT_LIFE = 6;
const DEFAULT_ATTACK = 4;
const DEFAULT_DEFENSE = 4;
const DEFAULT_SPEED = 4;
const DEFAULT_MOVEMENTS = 3;
const DEFAULT_ACTIONS = 1;
const DEFAULT_TURN_TIME = 18;
const DEFAULT_COMBAT_TURN_TIME = 10;

function createCharacter(overrides: Partial<Character> = {}): Character {
    return {
        id: 'player',
        isActif: false,
        battlesWon: 0,
        name: 'Player',
        avatarId: 1,
        maxLife: DEFAULT_LIFE,
        life: DEFAULT_LIFE,
        speed: DEFAULT_SPEED,
        attack: DEFAULT_ATTACK,
        defense: DEFAULT_DEFENSE,
        movements: DEFAULT_MOVEMENTS,
        actions: DEFAULT_ACTIONS,
        attackDice: Dice.D4,
        defenseDice: Dice.D6,
        position: { x: 1, y: 1 },
        remainingMovement: DEFAULT_MOVEMENTS,
        remainingActions: DEFAULT_ACTIONS,
        victories: 0,
        defeats: 0,
        totalDamageDealt: 0,
        totalDamageReceived: 0,
        tilesVisited: 0,
        hasFlag: false,
        ...overrides,
    };
}

function createPlayer(socketId: string, character: Character): Player {
    return { socketId, character };
}

type HandlerSessionShape = Pick<
    GameSession,
    | 'roomId'
    | 'players'
    | 'isTurnStarting'
    | 'gameMode'
    | 'isDebugModeActivated'
    | 'getActiveCombat'
    | 'setActiveCombat'
    | 'clearActiveCombat'
    | 'getCharacterById'
    | 'getCurrentPlayer'
    | 'setCurrentCombatTurnTime'
    | 'getCurrentCombatTurnTime'
    | 'getCurrentTurnTime'
    | 'getFlagPosition'
    | 'getFlagHolder'
> & { activeCombat: ActiveCombat | null };

function createSession(attacker: Character, defender: Character): HandlerSessionShape {
    return {
        roomId: 'ROOM1',
        players: [
            createPlayer('socket-1', attacker),
            createPlayer('socket-2', defender),
        ],
        isTurnStarting: false,
        gameMode: 'classic',
        isDebugModeActivated: false,
        activeCombat: null,
        getActiveCombat(): ActiveCombat | null {
            return this.activeCombat;
        },
        setActiveCombat(combat: ActiveCombat | null): void {
            this.activeCombat = combat;
        },
        clearActiveCombat(): void {
            this.activeCombat = null;
        },
        getCharacterById(id: string): Character | undefined {
            return this.players.find((player) => player.character.id === id)?.character;
        },
        getCurrentPlayer(): Character | undefined {
            return attacker;
        },
        setCurrentCombatTurnTime: jest.fn(),
        getCurrentCombatTurnTime: jest.fn(() => DEFAULT_COMBAT_TURN_TIME),
        getCurrentTurnTime: jest.fn(() => DEFAULT_TURN_TIME),
        getFlagPosition: jest.fn(() => null),
        getFlagHolder: jest.fn(() => null),
    };
}

describe('GamePlayCombatHandler', () => {
    let handler: GamePlayCombatHandler;
    let attacker: Character;
    let defender: Character;

    let getGameSessionSpy: jest.Mock;
    let checkGameWinnerSpy: jest.Mock;
    let endCurrentTurnSpy: jest.Mock;
    let pauseTurnTimerSpy: jest.Mock;
    let stopCombatTimerSpy: jest.Mock;
    let startCombatTimerSpy: jest.Mock;
    let resumeTurnTimerSpy: jest.Mock;
    let isCombatUnavailableSpy: jest.Mock;
    let getCombatParticipantsFromRequestSpy: jest.Mock;
    let canStartCombatSpy: jest.Mock;
    let buildRoundDetailsSpy: jest.Mock;
    let applyRoundDamageSpy: jest.Mock;
    let buildRoundResolvedPayloadSpy: jest.Mock;
    let determineRoundWinnerSpy: jest.Mock;
    let getCombatOutcomeSpy: jest.Mock;
    let prepareNextRoundSpy: jest.Mock;
    let buildCombatEndStateSpy: jest.Mock;

    let roomEmitSpy: jest.Mock;
    let serverToSpy: jest.Mock;
    let context: GamePlayHandlerContext;

    beforeEach(() => {
        attacker = createCharacter({
            id: 'attacker',
            name: 'Attacker',
            position: { x: 1, y: 1 },
            remainingActions: 1,
            remainingMovement: 2,
        });
        defender = createCharacter({
            id: 'defender',
            name: 'Defender',
            avatarId: 2,
            position: { x: 2, y: 1 },
        });

        getGameSessionSpy = jest.fn();
        checkGameWinnerSpy = jest.fn(() => null);
        endCurrentTurnSpy = jest.fn();

        pauseTurnTimerSpy = jest.fn();
        stopCombatTimerSpy = jest.fn();
        startCombatTimerSpy = jest.fn();
        resumeTurnTimerSpy = jest.fn();

        isCombatUnavailableSpy = jest.fn(() => false);
        getCombatParticipantsFromRequestSpy = jest.fn();
        canStartCombatSpy = jest.fn(() => true);

        buildRoundDetailsSpy = jest.fn();
        applyRoundDamageSpy = jest.fn();
        buildRoundResolvedPayloadSpy = jest.fn();
        determineRoundWinnerSpy = jest.fn();
        getCombatOutcomeSpy = jest.fn();
        prepareNextRoundSpy = jest.fn();

        buildCombatEndStateSpy = jest.fn();

        roomEmitSpy = jest.fn();
        serverToSpy = jest.fn(() => ({ emit: roomEmitSpy }));

        context = {
            server: { to: serverToSpy } as unknown as Server,
            logService: { log: jest.fn() } as GamePlayHandlerContext['logService'],
            onGameEnd: jest.fn(),
            onGameEndCanceled: jest.fn(),
            onTurnEnd: jest.fn(),
            emitReachableTiles: jest.fn(),
        };

        handler = new GamePlayCombatHandler(
            {
                getGameSession: getGameSessionSpy,
                checkGameWinner: checkGameWinnerSpy,
                endCurrentTurn: endCurrentTurnSpy,
            } as unknown as GameSessionService,
            {
                pauseTurnTimer: pauseTurnTimerSpy,
                stopCombatTimer: stopCombatTimerSpy,
                startCombatTimer: startCombatTimerSpy,
                resumeTurnTimer: resumeTurnTimerSpy,
            } as unknown as TurnManagementService,
            {
                isCombatUnavailable: isCombatUnavailableSpy,
                getCombatParticipantsFromRequest: getCombatParticipantsFromRequestSpy,
                canStartCombat: canStartCombatSpy,
            } as unknown as CombatRequestValidatorService,
            {
                buildRoundDetails: buildRoundDetailsSpy,
                applyRoundDamage: applyRoundDamageSpy,
                buildRoundResolvedPayload: buildRoundResolvedPayloadSpy,
                determineRoundWinner: determineRoundWinnerSpy,
                getCombatOutcome: getCombatOutcomeSpy,
                prepareNextRound: prepareNextRoundSpy,
            } as unknown as CombatRoundService,
            {
                buildCombatEndState: buildCombatEndStateSpy,
            } as unknown as CombatEndService,
        );
    });

    it('devrait démarrer un combat valide, consommer une action et émettre CombatStarted', () => {
        const session = createSession(attacker, defender);
        const participants: CombatParticipants = {
            attacker,
            defender,
            requestingPlayer: createPlayer('socket-1', attacker),
        };

        getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        getCombatParticipantsFromRequestSpy.mockReturnValue(participants);

        handler.handleRequestCombat(
            { id: 'socket-1' } as unknown as Socket,
            { roomId: 'ROOM1', defenderId: 'defender' },
            context,
        );

        expect(attacker.remainingActions).toBe(0);
        expect(session.activeCombat?.attackerId).toBe('attacker');
        expect(pauseTurnTimerSpy).toHaveBeenCalledWith('ROOM1');
        expect(serverToSpy).toHaveBeenCalledWith('ROOM1');
        expect(roomEmitSpy).toHaveBeenCalledWith(
            CombatEvents.CombatStarted,
            expect.objectContaining({
                attackerId: 'attacker',
                defenderId: 'defender',
                roundNumber: 1,
            }),
        );
        expect(context.logService.log).toHaveBeenCalledWith(
            'ROOM1',
            'Début de combat: Attacker attaque Defender',
        );
    });

    it('ne devrait rien faire si la validation refuse le combat', () => {
        const session = createSession(attacker, defender);
        const participants: CombatParticipants = {
            attacker,
            defender,
            requestingPlayer: createPlayer('socket-1', attacker),
        };

        getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        getCombatParticipantsFromRequestSpy.mockReturnValue(participants);
        canStartCombatSpy.mockReturnValue(false);

        handler.handleRequestCombat(
            { id: 'socket-1' } as unknown as Socket,
            { roomId: 'ROOM1', defenderId: 'defender' },
            context,
        );

        expect(session.activeCombat).toBeNull();
        expect(roomEmitSpy).not.toHaveBeenCalled();
        expect(context.logService.log).not.toHaveBeenCalled();
    });

    it('devrait enregistrer la posture de l’attaquant sans résoudre tant que l’autre posture manque', () => {
        const session = createSession(attacker, defender);
        session.activeCombat = {
            attackerId: 'attacker',
            defenderId: 'defender',
            initiatorId: 'attacker',
            roundNumber: 1,
            attackerHp: DEFAULT_LIFE,
            defenderHp: DEFAULT_LIFE,
        };

        getGameSessionSpy.mockReturnValue(session as unknown as GameSession);

        const resolveCombatRoundSpy = jest
            .spyOn(
                handler as unknown as {
                    resolveCombatRound: (gameSession: GameSession, handlerContext: GamePlayHandlerContext) => void;
                },
                'resolveCombatRound',
            )
            .mockImplementation(() => undefined);

        handler.handlePostureChosen(
            { id: 'socket-1' } as unknown as Socket,
            { roomId: 'ROOM1', posture: COMBAT_POSTURE.OFFENSIVE },
            context,
        );

        expect(session.activeCombat.attackerPosture).toBe(COMBAT_POSTURE.OFFENSIVE);
        expect(stopCombatTimerSpy).not.toHaveBeenCalled();
        expect(resolveCombatRoundSpy).not.toHaveBeenCalled();
    });

    it('devrait arrêter le timer et résoudre le round quand les deux postures sont choisies', () => {
        const session = createSession(attacker, defender);
        session.activeCombat = {
            attackerId: 'attacker',
            defenderId: 'defender',
            initiatorId: 'attacker',
            roundNumber: 1,
            attackerPosture: COMBAT_POSTURE.OFFENSIVE,
            attackerHp: DEFAULT_LIFE,
            defenderHp: DEFAULT_LIFE,
        };

        getGameSessionSpy.mockReturnValue(session as unknown as GameSession);

        const resolveCombatRoundSpy = jest
            .spyOn(
                handler as unknown as {
                    resolveCombatRound: (gameSession: GameSession, handlerContext: GamePlayHandlerContext) => void;
                },
                'resolveCombatRound',
            )
            .mockImplementation(() => undefined);

        handler.handlePostureChosen(
            { id: 'socket-2' } as unknown as Socket,
            { roomId: 'ROOM1', posture: COMBAT_POSTURE.DEFENSIVE },
            context,
        );

        expect(session.activeCombat.defenderPosture).toBe(COMBAT_POSTURE.DEFENSIVE);
        expect(stopCombatTimerSpy).toHaveBeenCalledWith('ROOM1');
        expect(resolveCombatRoundSpy).toHaveBeenCalledWith(session, context);
    });

    it('devrait reprendre ou terminer le tour après un combat résolu selon turnShouldContinue', () => {
        const session = createSession(attacker, defender);
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
            attacker,
            defender,
            winner: attacker,
            loserIds: ['defender'],
            outcome: 'attacker',
            attackerPosition: attacker.position as Position,
            defenderPosition: { x: 5, y: 5 },
            turnShouldContinue: false,
        };

        getGameSessionSpy.mockReturnValue(session as unknown as GameSession);
        buildRoundDetailsSpy.mockReturnValue(roundDetails);
        buildRoundResolvedPayloadSpy.mockReturnValue(roundPayload);
        determineRoundWinnerSpy.mockReturnValue('attacker');
        getCombatOutcomeSpy.mockReturnValue('attacker');
        buildCombatEndStateSpy.mockReturnValue(combatEndState);

        (
            handler as unknown as {
                resolveCombatRound: (gameSession: GameSession, handlerContext: GamePlayHandlerContext) => void;
            }
        ).resolveCombatRound(session as unknown as GameSession, context);

        expect(stopCombatTimerSpy).toHaveBeenCalledWith('ROOM1');
        expect(buildCombatEndStateSpy).toHaveBeenCalled();
        expect(session.activeCombat).toBeNull();
        expect(roomEmitSpy).toHaveBeenCalledWith(
            CombatEvents.CombatResult,
            expect.objectContaining({
                attackerId: 'attacker',
                defenderId: 'defender',
                winnerId: 'attacker',
            }),
        );
        expect(endCurrentTurnSpy).toHaveBeenCalledWith(session);
        expect(context.onTurnEnd).toHaveBeenCalledWith(session);
        expect(context.emitReachableTiles).toHaveBeenCalledWith(session);
    });
});