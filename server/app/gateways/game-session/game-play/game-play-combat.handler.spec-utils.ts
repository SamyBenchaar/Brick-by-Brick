import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/interfaces/game-play-handler';
import { CombatEndService } from '@app/services/game-session/combat/combat-end/combat-end.service';
import { CombatRoundService } from '@app/services/game-session/combat/request-round/combat-round.service';
import { CombatRequestValidatorService } from '@app/services/game-session/combat/request-validator/combat-request-validator.service';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { Character } from '@common/character';
import { ActiveCombat } from '@common/combat';
import { Dice } from '@common/dice';
import { Player } from '@common/player';
import { Server } from 'socket.io';
import { GamePlayCombatHandler } from './game-play-combat.handler';

export const DEFAULT_LIFE = 6;
export const DEFAULT_ATTACK = 4;
export const DEFAULT_DEFENSE = 4;
export const DEFAULT_SPEED = 4;
export const DEFAULT_MOVEMENTS = 3;
export const DEFAULT_ACTIONS = 1;
export const DEFAULT_TURN_TIME = 18;
export const DEFAULT_COMBAT_TURN_TIME = 10;

export function createCharacter(overrides: Partial<Character> = {}): Character {
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

export function createPlayer(socketId: string, character: Character): Player {
    return { socketId, character };
}

export type HandlerSessionShape = Pick<
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

export function createSession(attacker: Character, defender: Character): HandlerSessionShape {
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

export interface CombatHandlerHarness {
    handler: GamePlayCombatHandler;
    attacker: Character;
    defender: Character;
    getGameSessionSpy: jest.Mock;
    checkGameWinnerSpy: jest.Mock;
    endCurrentTurnSpy: jest.Mock;
    pauseTurnTimerSpy: jest.Mock;
    stopCombatTimerSpy: jest.Mock;
    startCombatTimerSpy: jest.Mock;
    resumeTurnTimerSpy: jest.Mock;
    isCombatUnavailableSpy: jest.Mock;
    getCombatParticipantsFromRequestSpy: jest.Mock;
    canStartCombatSpy: jest.Mock;
    buildRoundDetailsSpy: jest.Mock;
    applyRoundDamageSpy: jest.Mock;
    buildRoundResolvedPayloadSpy: jest.Mock;
    determineRoundWinnerSpy: jest.Mock;
    getCombatOutcomeSpy: jest.Mock;
    prepareNextRoundSpy: jest.Mock;
    buildCombatEndStateSpy: jest.Mock;
    roomEmitSpy: jest.Mock;
    serverToSpy: jest.Mock;
    context: GamePlayHandlerContext;
}

export function createCombatHandlerHarness(): CombatHandlerHarness {
    const attacker = createCharacter({
        id: 'attacker',
        name: 'Attacker',
        position: { x: 1, y: 1 },
        remainingActions: 1,
        remainingMovement: 2,
    });
    const defender = createCharacter({
        id: 'defender',
        name: 'Defender',
        avatarId: 2,
        position: { x: 2, y: 1 },
    });

    const getGameSessionSpy = jest.fn();
    const checkGameWinnerSpy = jest.fn(() => null);
    const endCurrentTurnSpy = jest.fn();

    const pauseTurnTimerSpy = jest.fn();
    const stopCombatTimerSpy = jest.fn();
    const startCombatTimerSpy = jest.fn();
    const resumeTurnTimerSpy = jest.fn();

    const isCombatUnavailableSpy = jest.fn(() => false);
    const getCombatParticipantsFromRequestSpy = jest.fn();
    const canStartCombatSpy = jest.fn(() => true);

    const buildRoundDetailsSpy = jest.fn();
    const applyRoundDamageSpy = jest.fn();
    const buildRoundResolvedPayloadSpy = jest.fn();
    const determineRoundWinnerSpy = jest.fn();
    const getCombatOutcomeSpy = jest.fn();
    const prepareNextRoundSpy = jest.fn();

    const buildCombatEndStateSpy = jest.fn();

    const roomEmitSpy = jest.fn();
    const serverToSpy = jest.fn(() => ({ emit: roomEmitSpy }));

    const context: GamePlayHandlerContext = {
        server: { to: serverToSpy } as unknown as Server,
        logService: { log: jest.fn() } as unknown as GamePlayHandlerContext['logService'],
        onGameEnd: jest.fn(),
        onGameEndCanceled: jest.fn(),
        onTurnEnd: jest.fn(),
        emitReachableTiles: jest.fn(),
    };

    const handler = new GamePlayCombatHandler(
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

    return {
        handler,
        attacker,
        defender,
        getGameSessionSpy,
        checkGameWinnerSpy,
        endCurrentTurnSpy,
        pauseTurnTimerSpy,
        stopCombatTimerSpy,
        startCombatTimerSpy,
        resumeTurnTimerSpy,
        isCombatUnavailableSpy,
        getCombatParticipantsFromRequestSpy,
        canStartCombatSpy,
        buildRoundDetailsSpy,
        applyRoundDamageSpy,
        buildRoundResolvedPayloadSpy,
        determineRoundWinnerSpy,
        getCombatOutcomeSpy,
        prepareNextRoundSpy,
        buildCombatEndStateSpy,
        roomEmitSpy,
        serverToSpy,
        context,
    };
}
